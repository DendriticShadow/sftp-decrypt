# Lambda + Fargate Decryption

This component deploys the Lambda orchestrator and Fargate worker for PGP decryption.

## Resources Created

- ECR repository for Docker images
- ECS Cluster
- ECS Task Definition (Fargate)
- Lambda orchestrator function
- IAM roles (task execution, task runtime, Lambda execution)
- Security group for Fargate tasks
- CloudWatch log groups

## Architecture

```
AWS Transfer Workflow
    ↓
Lambda Orchestrator
    ├── Check file size
    └── Start Fargate task if >= 1 GB
        ↓
Fargate Worker
    ├── Download encrypted file
    ├── Decrypt (streaming)
    ├── Upload decrypted file
    └── Send workflow callback
```

## Exports

This stack exports the following values:

- `sftp-decrypt-ECRRepositoryUri` - ECR repository URI
- `sftp-decrypt-ECSClusterName` - ECS cluster name
- `sftp-decrypt-TaskDefinitionArn` - Task definition ARN
- `sftp-decrypt-OrchestratorFunctionArn` - Lambda function ARN
- `sftp-decrypt-OrchestratorFunctionName` - Lambda function name
- `sftp-decrypt-FargateSecurityGroupId` - Security group ID
- `sftp-decrypt-FargateLogGroupName` - CloudWatch log group name

## Deployment

### Full Deployment (Automated)
```bash
./deploy.sh [stack-name] [project-name] [region]
```

Example:
```bash
./deploy.sh sftp-decrypt-lambda-fargate sftp-decrypt us-east-1
```

This script will:
1. Deploy infrastructure with placeholder image
2. Build Docker image
3. Push to ECR
4. Update infrastructure with real image
5. Deploy Lambda code

### Manual Steps

#### 1. Build Docker Image
```bash
cd fargate
npm install --production
cd ..

./scripts/build-fargate-image.sh <ecr-uri> us-east-1
```

#### 2. Deploy Lambda Code
```bash
./scripts/deploy-lambda-code.sh <function-name> us-east-1
```

## Directory Structure

```
6-lambda-fargate/
├── template.yaml           # CloudFormation template
├── deploy.sh              # Deployment script
├── fargate/               # Fargate worker code
│   ├── decrypt.js        # Main decryption script
│   ├── Dockerfile        # Container definition
│   └── package.json      # Node.js dependencies
├── lambda/                # Lambda orchestrator code
│   ├── orchestrator.js   # Routing logic
│   └── package.json      # Node.js dependencies
└── scripts/               # Build/deploy scripts
    ├── build-fargate-image.sh
    ├── build-lambda-package.sh
    └── deploy-lambda-code.sh
```

## Parameters

- `ProjectName` - Project name (default: `sftp-decrypt`)
- `ContainerImage` - ECR image URI (required)
- `FargateThresholdGB` - File size threshold for Fargate (default: `1`)
- `FargateCpu` - CPU units (default: `4096`)
- `FargateMemory` - Memory in MB (default: `8192`)

## Dependencies

**Imports:**
- `sftp-decrypt-VpcId` (from VPC stack)
- `sftp-decrypt-PrivateSubnetIds` (from VPC stack)
- `sftp-decrypt-SourceBucketArn` (from S3 Buckets stack)
- `sftp-decrypt-DestinationBucketArn` (from S3 Buckets stack)
- `sftp-decrypt-TransferServerId` (from Transfer Server stack)

## Monitoring

### CloudWatch Logs

**Lambda:**
```bash
aws logs tail /aws/lambda/sftp-decrypt-lambda-fargate-orchestrator --follow
```

**Fargate:**
```bash
aws logs tail /ecs/sftp-decrypt-lambda-fargate-pgp-decrypt --follow
```

### Metrics

Monitor via CloudWatch:
- Lambda invocations and errors
- Fargate task count and CPU/memory
- Processing duration

## Cost Considerations

### Lambda Orchestrator
- **Invocations**: $0.20 per 1M requests
- **Duration**: $0.0000166667 per GB-second
- **Typical**: ~$0.0001 per file

### Fargate Worker
- **vCPU**: $0.04048 per vCPU-hour
- **Memory**: $0.004445 per GB-hour
- **Example (4 vCPU, 8 GB, 20 min)**: ~$0.054 per file

### Total Cost Examples
- 100 MB file (Lambda only): ~$0.0001
- 5 GB file (Fargate): ~$0.027
- 10 GB file (Fargate): ~$0.054

**1000 files/month (5 GB average)**: ~$27/month

## Performance

### Expected Processing Times

| File Size | Total Time | Lambda | Fargate |
|-----------|------------|--------|---------|
| 100 MB    | ~32s       | 2s     | 30s     |
| 1 GB      | ~3min      | 2s     | 3min    |
| 5 GB      | ~10min     | 2s     | 10min   |
| 10 GB     | ~20min     | 2s     | 20min   |

### Memory Usage

- Lambda: ~100 MB constant
- Fargate: ~1-2 GB constant (streaming architecture)

File size does NOT significantly impact memory usage.

## Troubleshooting

### Fargate Task Fails to Start

Check:
1. ECR image exists: `aws ecr describe-images --repository-name ...`
2. Subnets have internet access (NAT Gateway)
3. Security group allows outbound traffic
4. Task execution role can pull from ECR

### Decryption Fails

Check:
1. PGP credentials exist in Secrets Manager
2. Secret name matches: `aws/transfer/{server-id}/@pgp-default`
3. Task role has `secretsmanager:GetSecretValue` permission
4. Private key and passphrase are correct

### Memory Issues

For large ASCII-armored files, increase Fargate memory:
```bash
# Redeploy with more memory
aws cloudformation deploy \
  --parameter-overrides FargateMemory=16384
```
