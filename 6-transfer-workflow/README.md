# Transfer Family Workflow

This component creates the AWS Transfer Family workflow that triggers PGP decryption on file upload.

## Resources Created

- Transfer Family workflow with custom Lambda step
- On-success steps (delete original encrypted file)
- On-exception steps (move to quarantine, then delete)

## Workflow Steps

### Normal Flow (Success)
```
1. File uploaded via SFTP
2. Trigger Lambda function (decrypt)
3. Delete original encrypted file
```

### Exception Flow (Failure)
```
1. File uploaded via SFTP
2. Trigger Lambda function (decrypt)
3. [FAILS]
4. Copy file to quarantine/
5. Delete original file
```

## Exports

This stack exports the following values:

- `sftp-decrypt-WorkflowId` - Workflow ID
- `sftp-decrypt-WorkflowArn` - Workflow ARN

## Deployment

```bash
./deploy.sh [stack-name] [project-name] [region]
```

Example:
```bash
./deploy.sh sftp-decrypt-workflow sftp-decrypt us-east-1
```

## Parameters

- `ProjectName` - Project name (default: `sftp-decrypt`)

## Post-Deployment: Assign Workflow to Transfer Server

After deploying, you need to assign the workflow to your Transfer server:

```bash
# Get Workflow ID
WORKFLOW_ID=$(aws cloudformation describe-stacks \
  --stack-name sftp-decrypt-workflow \
  --query 'Stacks[0].Outputs[?OutputKey==`WorkflowId`].OutputValue' \
  --output text)

# Get Transfer Server ID
TRANSFER_ID=$(aws cloudformation describe-stacks \
  --stack-name sftp-decrypt-transfer \
  --query 'Stacks[0].Outputs[?OutputKey==`TransferServerId`].OutputValue' \
  --output text)

# Update server to use workflow
aws transfer update-server \
  --server-id $TRANSFER_ID \
  --workflow-details '{
    "OnUpload": [{
      "WorkflowId": "'$WORKFLOW_ID'",
      "ExecutionRole": "arn:aws:iam::ACCOUNT_ID:role/TransferWorkflowExecutionRole"
    }]
  }'
```

**Note**: You'll need to create the `TransferWorkflowExecutionRole` with appropriate permissions.

## Alternative: Assign at User Level

You can also assign workflows per user:

```bash
aws transfer update-user \
  --server-id $TRANSFER_ID \
  --user-name testuser \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/bucket/in/sftp/testuser"}]' \
  --role arn:aws:iam::ACCOUNT_ID:role/TransferUserRole \
  --workflow-details '{
    "OnUpload": [{
      "WorkflowId": "'$WORKFLOW_ID'",
      "ExecutionRole": "arn:aws:iam::ACCOUNT_ID:role/TransferWorkflowExecutionRole"
    }]
  }'
```

## Dependencies

**Imports:**
- `sftp-decrypt-TransferServerId` (from Transfer Server stack)
- `sftp-decrypt-OrchestratorFunctionArn` (from Lambda + Fargate stack)
- `sftp-decrypt-SourceBucketName` (from S3 Buckets stack)

## Testing the Workflow

1. Upload a PGP-encrypted file via SFTP:
   ```bash
   sftp testuser@${TRANSFER_ID}.server.transfer.us-east-1.amazonaws.com
   put encrypted-file.pgp
   ```

2. Monitor workflow execution:
   ```bash
   # Lambda logs
   aws logs tail /aws/lambda/sftp-decrypt-lambda-fargate-orchestrator --follow

   # Fargate logs (if triggered)
   aws logs tail /ecs/sftp-decrypt-lambda-fargate-pgp-decrypt --follow
   ```

3. Check results:
   ```bash
   # List decrypted files
   aws s3 ls s3://my-bucket/in/decrypted/testuser/

   # List quarantined files (if failed)
   aws s3 ls s3://my-bucket/quarantine/testuser/
   ```

## Workflow Variables

The workflow uses these built-in variables:

- `${original.file}` - Original file path
- `${transfer:UserName}` - SFTP username
- `${transfer:UploadDate}` - Upload timestamp

## Cost Considerations

- **Workflow Executions**: First 1000 free, then $0.30 per 1000 executions
- **Additional Steps**: No extra charge (part of workflow execution)

**Example**: 10,000 files/month = ~$2.70/month

## Monitoring

### CloudWatch Logs

Workflow execution logs are in the Transfer Server log group:
```bash
aws logs tail /aws/transfer/sftp-decrypt --follow
```

### Metrics

Monitor workflow success/failure rates via CloudWatch metrics:
- `WorkflowExecutions`
- `WorkflowExecutionFailures`
