#!/usr/bin/env node

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { TransferClient, SendWorkflowStepStateCommand } = require('@aws-sdk/client-transfer');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const openpgp = require('openpgp');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable, Transform } = require('stream');

// AWS Clients with extended timeouts for large files
const s3Client = new S3Client({
    requestHandler: new NodeHttpHandler({
        requestTimeout: 600000,  // 10 minutes
        connectionTimeout: 300000,
        socketTimeout: 600000
    }),
    maxAttempts: 3
});
const secretsClient = new SecretsManagerClient();
const transferClient = new TransferClient();

// Utility: Extract username and path from S3 key
const extractPathComponents = (s3Key) => {
    const pathParts = s3Key.split('/');
    if (pathParts[0] === 'in' && pathParts[1] === 'sftp' && pathParts[2]) {
        const username = pathParts[2];
        const remainingPath = pathParts.slice(3).join('/');
        return { username, remainingPath };
    }
    throw new Error(`Invalid S3 key format: ${s3Key}. Expected: in/sftp/{username}/...`);
};

// Progress tracker for container logs
const createProgressTracker = (totalBytes, label) => {
    let bytesProcessed = 0;
    const startTime = Date.now();
    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
    let lastLogTime = startTime;
    const LOG_INTERVAL = 5000; // Log every 5 seconds

    console.log(`[${label}] Starting: ${totalMB} MB`);

    const updateProgress = (chunkSize) => {
        bytesProcessed += chunkSize;
        const now = Date.now();

        // Log progress every 5 seconds
        if (now - lastLogTime >= LOG_INTERVAL) {
            const elapsed = (now - startTime) / 1000;
            const processedMB = (bytesProcessed / 1024 / 1024).toFixed(2);
            const speed = elapsed > 0 ? (bytesProcessed / 1024 / 1024 / elapsed).toFixed(2) : '0.00';
            const percentage = ((bytesProcessed / totalBytes) * 100).toFixed(1);

            console.log(`[${label}] Progress: ${processedMB}/${totalMB} MB (${percentage}%) @ ${speed} MB/s`);
            lastLogTime = now;
        }
    };

    const finish = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = (totalBytes / 1024 / 1024 / elapsed).toFixed(2);
        console.log(`[${label}] Complete: ${totalMB} MB in ${elapsed.toFixed(1)}s (${speed} MB/s)`);
    };

    return { updateProgress, finish };
};

// Get PGP credentials from Secrets Manager
const getPGPCredentials = async (serverId) => {
    const secretName = `aws/transfer/${serverId}/@pgp-default`;

    try {
        console.log(`Retrieving PGP credentials: ${secretName}`);
        const response = await secretsClient.send(new GetSecretValueCommand({
            SecretId: secretName
        }));

        const secret = JSON.parse(response.SecretString);

        if (!secret.PGPPrivateKey || !secret.PGPPassphrase) {
            throw new Error('PGP credentials missing required fields: PGPPrivateKey and PGPPassphrase');
        }

        console.log('Successfully retrieved PGP credentials');
        return {
            privateKey: secret.PGPPrivateKey,
            passphrase: secret.PGPPassphrase
        };
    } catch (error) {
        throw new Error(`Failed to retrieve PGP credentials from ${secretName}: ${error.message}`);
    }
};

// Generate unique temp file paths
const getTempFilePath = (prefix, filename) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return path.join('/tmp', `${prefix}-${timestamp}-${random}-${filename}`);
};

// Download file from S3 with progress tracking
const downloadFromS3 = async (bucket, key, filePath) => {
    console.log(`Downloading s3://${bucket}/${key}`);

    const getResponse = await s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key
    }));

    const totalBytes = parseInt(getResponse.ContentLength || 0);
    const progress = createProgressTracker(totalBytes, 'Download');

    const progressStream = new Transform({
        transform(chunk, encoding, callback) {
            progress.updateProgress(chunk.length);
            callback(null, chunk);
        }
    });

    const writeStream = fs.createWriteStream(filePath, {
        highWaterMark: 1024 * 1024  // 1 MB chunks
    });

    try {
        await pipeline(getResponse.Body, progressStream, writeStream);
        progress.finish();
    } catch (error) {
        progress.finish();
        throw error;
    }

    const fileSize = fs.statSync(filePath).size;
    console.log(`Downloaded to ${filePath}, size: ${fileSize} bytes`);

    return filePath;
};

// Upload file to S3 with progress tracking
const uploadToS3 = async (filePath, bucket, key) => {
    console.log(`Uploading to s3://${bucket}/${key}`);

    const fileSize = fs.statSync(filePath).size;
    const progress = createProgressTracker(fileSize, 'Upload');

    const fileStream = fs.createReadStream(filePath, {
        highWaterMark: 1024 * 1024  // 1 MB chunks
    });

    const progressTransform = new Transform({
        transform(chunk, encoding, callback) {
            progress.updateProgress(chunk.length);
            callback(null, chunk);
        }
    });

    const trackedStream = fileStream.pipe(progressTransform);

    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: trackedStream,
            ContentLength: fileSize
        }));
        progress.finish();
    } catch (error) {
        progress.finish();
        throw error;
    }

    console.log(`Upload complete, size: ${fileSize} bytes`);
};

// Cleanup temp files
const cleanupFiles = async (...filePaths) => {
    for (const filePath of filePaths) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up: ${filePath}`);
            }
        } catch (error) {
            console.error(`Failed to cleanup ${filePath}:`, error.message);
        }
    }
};

// Decrypt PGP file with streaming support
const decryptPGPFile = async (encryptedFilePath, decryptedFilePath, privateKeyText, passphrase) => {
    console.log('Starting PGP decryption');

    const fileSize = fs.statSync(encryptedFilePath).size;
    console.log(`Encrypted file size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyText });
    console.log('Loaded PGP private key');

    const decryptedPrivateKey = await openpgp.decryptKey({ privateKey, passphrase });
    console.log('Unlocked private key with passphrase');

    // Detect format (binary vs ASCII-armored)
    const sampleBuffer = Buffer.alloc(Math.min(100, fileSize));
    const fd = fs.openSync(encryptedFilePath, 'r');
    fs.readSync(fd, sampleBuffer, 0, sampleBuffer.length, 0);
    fs.closeSync(fd);

    const testString = sampleBuffer.toString('ascii');
    let isAsciiArmored = false;
    if (testString.includes('-----BEGIN PGP MESSAGE-----')) {
        const printableChars = testString.split('').filter(c => {
            const code = c.charCodeAt(0);
            return (code >= 32 && code <= 126) || code === 10 || code === 13;
        }).length;
        isAsciiArmored = printableChars / testString.length > 0.9;
    }

    console.log(`Format detected: ${isAsciiArmored ? 'ASCII-armored' : 'binary'}`);

    let message;
    let decrypted;

    if (isAsciiArmored) {
        console.log('Using buffer-based decryption for ASCII-armored format');
        console.log('Note: ASCII-armored files are limited by available memory');

        const encryptedContent = fs.readFileSync(encryptedFilePath, 'utf8');

        message = await openpgp.readMessage({
            armoredMessage: encryptedContent
        });

        console.log('Decrypting (buffer-based)...');
        decrypted = await openpgp.decrypt({
            message,
            decryptionKeys: decryptedPrivateKey,
            format: 'binary'
        });

        console.log('Writing decrypted data to file');
        const decryptedBuffer = Buffer.from(await decrypted.data);
        fs.writeFileSync(decryptedFilePath, decryptedBuffer);

    } else {
        console.log('Using stream-based decryption for binary format');

        const encryptedStream = fs.createReadStream(encryptedFilePath, {
            highWaterMark: 1024 * 1024  // 1 MB chunks
        });
        const webStream = Readable.toWeb(encryptedStream);

        message = await openpgp.readMessage({
            binaryMessage: webStream
        });

        console.log('Decrypting (streaming)...');
        decrypted = await openpgp.decrypt({
            message,
            decryptionKeys: decryptedPrivateKey,
            format: 'binary',
            config: { allowUnauthenticatedStream: true }
        });

        console.log('Streaming decrypted data to file');
        const progress = createProgressTracker(fileSize, 'Decrypt');

        const progressStream = new Transform({
            transform(chunk, encoding, callback) {
                progress.updateProgress(chunk.length);
                callback(null, chunk);
            }
        });

        const writeStream = fs.createWriteStream(decryptedFilePath, {
            highWaterMark: 1024 * 1024  // 1 MB chunks
        });
        const decryptedNodeStream = Readable.fromWeb(decrypted.data);

        try {
            await pipeline(decryptedNodeStream, progressStream, writeStream);
            progress.finish();
        } catch (error) {
            progress.finish();
            throw error;
        }
    }

    const decryptedSize = fs.statSync(decryptedFilePath).size;
    console.log(`Decryption complete, size: ${(decryptedSize / 1024 / 1024).toFixed(2)} MB`);

    return decryptedFilePath;
};

// Send workflow callback to AWS Transfer Family
const sendWorkflowCallback = async (workflowId, executionId, token, status) => {
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
    }
};

// Main function
async function main() {
    let encryptedFilePath = null;
    let decryptedFilePath = null;

    try {
        console.log('=== Fargate PGP Decryption Task Started ===');

        // Get configuration from environment variables
        const sourceBucket = process.env.SOURCE_BUCKET;
        const sourceKey = process.env.SOURCE_KEY;
        const destinationBucket = process.env.DESTINATION_BUCKET;
        const destinationKey = process.env.DESTINATION_KEY;
        const serverId = process.env.TRANSFER_SERVER_ID;
        const workflowId = process.env.WORKFLOW_ID || null;
        const executionId = process.env.EXECUTION_ID || null;
        const token = process.env.WORKFLOW_TOKEN || null;

        // Validate required environment variables
        if (!sourceBucket || !sourceKey || !destinationBucket || !destinationKey || !serverId) {
            throw new Error('Missing required environment variables: SOURCE_BUCKET, SOURCE_KEY, DESTINATION_BUCKET, DESTINATION_KEY, TRANSFER_SERVER_ID');
        }

        console.log(`Source: s3://${sourceBucket}/${sourceKey}`);
        console.log(`Destination: s3://${destinationBucket}/${destinationKey}`);
        console.log(`Transfer Server: ${serverId}`);

        // Get PGP credentials
        const { privateKey, passphrase } = await getPGPCredentials(serverId);

        // Setup temp file paths
        const originalFilename = path.basename(sourceKey);
        encryptedFilePath = getTempFilePath('encrypted', originalFilename);
        decryptedFilePath = getTempFilePath('decrypted', originalFilename);

        console.log(`Temp encrypted: ${encryptedFilePath}`);
        console.log(`Temp decrypted: ${decryptedFilePath}`);

        // Download encrypted file from S3
        await downloadFromS3(sourceBucket, sourceKey, encryptedFilePath);

        // Decrypt the file
        await decryptPGPFile(encryptedFilePath, decryptedFilePath, privateKey, passphrase);

        // Upload decrypted file to S3
        await uploadToS3(decryptedFilePath, destinationBucket, destinationKey);

        // Cleanup temp files
        await cleanupFiles(encryptedFilePath, decryptedFilePath);

        // Send success callback to Transfer Family workflow
        await sendWorkflowCallback(workflowId, executionId, token, 'SUCCESS');

        console.log('=== Decryption Task Completed Successfully ===');
        process.exit(0);

    } catch (error) {
        console.error('=== Decryption Task Failed ===');
        console.error(`Error: ${error.message}`);
        console.error(error.stack);

        // Cleanup temp files
        await cleanupFiles(encryptedFilePath, decryptedFilePath);

        // Send failure callback to Transfer Family workflow
        const workflowId = process.env.WORKFLOW_ID || null;
        const executionId = process.env.EXECUTION_ID || null;
        const token = process.env.WORKFLOW_TOKEN || null;
        await sendWorkflowCallback(workflowId, executionId, token, 'FAILURE');

        process.exit(1);
    }
}

// Run main function
main();
