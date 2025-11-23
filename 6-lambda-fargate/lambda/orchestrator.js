const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { TransferClient, SendWorkflowStepStateCommand } = require('@aws-sdk/client-transfer');

const ecsClient = new ECSClient();
const s3Client = new S3Client();
const transferClient = new TransferClient();

// Configuration from environment variables
const ECS_CLUSTER = process.env.ECS_CLUSTER_NAME;
const TASK_DEFINITION = process.env.TASK_DEFINITION;
const SUBNET_IDS = process.env.SUBNET_IDS ? process.env.SUBNET_IDS.split(',') : [];
const SECURITY_GROUP_ID = process.env.SECURITY_GROUP_ID;
const DESTINATION_BUCKET = process.env.DESTINATION_BUCKET;
const TRANSFER_SERVER_ID = process.env.TRANSFER_SERVER_ID;
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'decrypt-container';

// File size threshold for Fargate (default: 1 GB)
const FARGATE_THRESHOLD = parseInt(process.env.FARGATE_THRESHOLD_BYTES || (1 * 1024 * 1024 * 1024));

// Extract username and path from S3 key
const extractPathComponents = (s3Key) => {
    const pathParts = s3Key.split('/');
    if (pathParts[0] === 'in' && pathParts[1] === 'sftp' && pathParts[2]) {
        const username = pathParts[2];
        const remainingPath = pathParts.slice(3).join('/');
        return { username, remainingPath };
    }
    throw new Error(`Invalid S3 key format: ${s3Key}. Expected: in/sftp/{username}/...`);
};

// Get file size from S3
const getFileSize = async (bucket, key) => {
    try {
        const response = await s3Client.send(new HeadObjectCommand({
            Bucket: bucket,
            Key: key
        }));
        return response.ContentLength;
    } catch (error) {
        throw new Error(`Failed to get file size for s3://${bucket}/${key}: ${error.message}`);
    }
};

// Start Fargate task to decrypt file
const startFargateTask = async (config) => {
    const {
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
        serverId,
        workflowId,
        executionId,
        token
    } = config;

    console.log(`Starting Fargate task for s3://${sourceBucket}/${sourceKey}`);

    // Build environment variables for the container
    const environment = [
        { name: 'SOURCE_BUCKET', value: sourceBucket },
        { name: 'SOURCE_KEY', value: sourceKey },
        { name: 'DESTINATION_BUCKET', value: destinationBucket },
        { name: 'DESTINATION_KEY', value: destinationKey },
        { name: 'TRANSFER_SERVER_ID', value: serverId }
    ];

    // Add workflow callback info if available
    if (workflowId) environment.push({ name: 'WORKFLOW_ID', value: workflowId });
    if (executionId) environment.push({ name: 'EXECUTION_ID', value: executionId });
    if (token) environment.push({ name: 'WORKFLOW_TOKEN', value: token });

    try {
        const response = await ecsClient.send(new RunTaskCommand({
            cluster: ECS_CLUSTER,
            taskDefinition: TASK_DEFINITION,
            launchType: 'FARGATE',
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: SUBNET_IDS,
                    securityGroups: [SECURITY_GROUP_ID],
                    assignPublicIp: 'ENABLED'
                }
            },
            overrides: {
                containerOverrides: [
                    {
                        name: CONTAINER_NAME,
                        environment: environment
                    }
                ]
            }
        }));

        if (!response.tasks || response.tasks.length === 0) {
            throw new Error('Failed to start Fargate task: No tasks returned');
        }

        const taskArn = response.tasks[0].taskArn;
        console.log(`Started Fargate task: ${taskArn}`);

        return {
            taskArn,
            clusterArn: response.tasks[0].clusterArn
        };
    } catch (error) {
        throw new Error(`Failed to start Fargate task: ${error.message}`);
    }
};

// Send workflow callback to AWS Transfer Family
const sendWorkflowCallback = async (workflowId, executionId, token, status, message) => {
    if (!workflowId || !executionId || !token) {
        console.log('No workflow callback info provided, skipping callback');
        return;
    }

    try {
        await transferClient.send(new SendWorkflowStepStateCommand({
            WorkflowId: workflowId,
            ExecutionId: executionId,
            Token: token,
            Status: status
        }));
        console.log(`Sent ${status} status to AWS Transfer Family workflow`);
    } catch (error) {
        console.error(`Failed to send workflow callback: ${error.message}`);
        throw error;
    }
};

// Lambda handler
exports.handler = async (event, context) => {
    try {
        console.log('Orchestrator started', JSON.stringify(event));

        // Extract file location from event
        const fileLocation = event.fileLocation || event.initialFileLocation;
        if (!fileLocation) {
            throw new Error('No file location provided in event');
        }

        const { bucket, key } = fileLocation;
        console.log(`Processing file: s3://${bucket}/${key}`);

        // Extract username and path
        const { username, remainingPath } = extractPathComponents(key);
        console.log(`Username: ${username}, Path: ${remainingPath}`);

        // Get file size
        const fileSize = await getFileSize(bucket, key);
        const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
        console.log(`File size: ${fileSizeMB} MB (${fileSize} bytes)`);

        // Get Transfer Server ID from event or environment
        const serverId = event.transferDetails?.serverId || TRANSFER_SERVER_ID;
        if (!serverId) {
            throw new Error('Server ID not found in event or environment variables');
        }
        console.log(`Transfer Server ID: ${serverId}`);

        // Calculate destination key (remove .pgp extension)
        let processedPath = remainingPath;
        if (processedPath.toLowerCase().endsWith('.pgp')) {
            processedPath = processedPath.slice(0, -4);
        }
        const destinationKey = `in/decrypted/${username}/${processedPath}`;
        console.log(`Destination: s3://${DESTINATION_BUCKET}/${destinationKey}`);

        // Get workflow details for callback
        const workflowId = event.serviceMetadata?.executionDetails?.workflowId || null;
        const executionId = event.serviceMetadata?.executionDetails?.executionId || null;
        const token = event.token || null;

        // Decision: Use Fargate or process inline?
        const thresholdMB = (FARGATE_THRESHOLD / 1024 / 1024).toFixed(0);

        if (fileSize >= FARGATE_THRESHOLD) {
            console.log(`File size (${fileSizeMB} MB) >= threshold (${thresholdMB} MB), starting Fargate task`);

            // Start Fargate task
            const result = await startFargateTask({
                sourceBucket: bucket,
                sourceKey: key,
                destinationBucket: DESTINATION_BUCKET,
                destinationKey: destinationKey,
                serverId: serverId,
                workflowId: workflowId,
                executionId: executionId,
                token: token
            });

            console.log('Fargate task started successfully');
            console.log('Note: Fargate task will handle workflow callback when complete');

            return {
                statusCode: 202,
                body: JSON.stringify({
                    message: 'Decryption started in Fargate',
                    taskArn: result.taskArn,
                    fileSize: fileSize,
                    fileSizeMB: fileSizeMB
                })
            };

        } else {
            console.log(`File size (${fileSizeMB} MB) < threshold (${thresholdMB} MB)`);
            console.log('Small files could be processed inline with Lambda');
            console.log('For now, this orchestrator only handles Fargate routing');

            // Send failure callback since we're not processing it
            if (token) {
                await sendWorkflowCallback(
                    workflowId,
                    executionId,
                    token,
                    'FAILURE',
                    'File below Fargate threshold, inline Lambda processing not yet implemented'
                );
            }

            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'File below Fargate threshold, inline processing not implemented',
                    fileSize: fileSize,
                    fileSizeMB: fileSizeMB,
                    threshold: FARGATE_THRESHOLD
                })
            };
        }

    } catch (error) {
        console.error('Orchestrator failed:', error.message);
        console.error(error.stack);

        // Send failure callback to workflow
        try {
            const workflowId = event.serviceMetadata?.executionDetails?.workflowId || null;
            const executionId = event.serviceMetadata?.executionDetails?.executionId || null;
            const token = event.token || null;

            if (token) {
                await sendWorkflowCallback(workflowId, executionId, token, 'FAILURE', error.message);
            }
        } catch (callbackError) {
            console.error('Failed to send failure callback:', callbackError.message);
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Orchestrator failed',
                message: error.message
            })
        };
    }
};
