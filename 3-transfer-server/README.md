# AWS Transfer Family Server

This component creates the AWS Transfer Family SFTP server.

## Resources Created

- Transfer Family SFTP server
- CloudWatch Log Group for Transfer logs
- IAM role for server logging
- IAM role for Transfer users (S3 access)

## Exports

This stack exports the following values:

- `sftp-decrypt-TransferServerId` - Transfer server ID (e.g., `s-1234567890abcdef0`)
- `sftp-decrypt-TransferServerArn` - Transfer server ARN
- `sftp-decrypt-TransferServerEndpoint` - SFTP connection endpoint
- `sftp-decrypt-TransferUserRoleArn` - IAM role ARN for Transfer users
- `sftp-decrypt-TransferLogGroupName` - CloudWatch log group name

## Deployment

```bash
./deploy.sh [stack-name] [project-name] [region]
```

Example:
```bash
./deploy.sh sftp-decrypt-transfer sftp-decrypt us-east-1
```

## Parameters

- `ProjectName` - Project name (default: `sftp-decrypt`)
- `IdentityProviderType` - Identity provider (default: `SERVICE_MANAGED`)
- `EndpointType` - Endpoint type (default: `PUBLIC`)

## Post-Deployment: Creating SFTP Users

After deploying the stack, create SFTP users:

```bash
# Get Transfer Server ID
TRANSFER_ID=$(aws cloudformation describe-stacks \
  --stack-name sftp-decrypt-transfer \
  --query 'Stacks[0].Outputs[?OutputKey==`TransferServerId`].OutputValue' \
  --output text)

# Get User Role ARN
ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name sftp-decrypt-transfer \
  --query 'Stacks[0].Outputs[?OutputKey==`TransferUserRoleArn`].OutputValue' \
  --output text)

# Create user
aws transfer create-user \
  --server-id $TRANSFER_ID \
  --user-name testuser \
  --role $ROLE_ARN \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/my-sftp-bucket/in/sftp/testuser"}]'

# Add SSH public key for authentication
aws transfer import-ssh-public-key \
  --server-id $TRANSFER_ID \
  --user-name testuser \
  --ssh-public-key-body "$(cat ~/.ssh/id_rsa.pub)"
```

## Connecting via SFTP

```bash
# Get SFTP endpoint
SFTP_ENDPOINT="${TRANSFER_ID}.server.transfer.us-east-1.amazonaws.com"

# Connect
sftp -i ~/.ssh/id_rsa testuser@$SFTP_ENDPOINT
```

## Dependencies

- **Imports**: `sftp-decrypt-SourceBucketArn` (from S3 Buckets stack)

## Cost Considerations

- **SFTP Endpoint**: $0.30/hour = ~$216/month
- **Data Upload**: $0.04/GB uploaded
- **Data Download**: First 50 GB free, then varies by region

**Example**: Endpoint + 100 GB uploads/month = ~$220/month
