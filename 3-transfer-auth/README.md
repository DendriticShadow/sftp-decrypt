# Transfer Family Lambda Authentication

This stack deploys a Lambda function that handles user authentication for the AWS Transfer Family SFTP server.

## Overview

The Lambda function authenticates users by retrieving their configuration from AWS Secrets Manager. User secrets contain:
- SSH public keys
- Home directory mappings
- IAM role
- Optional IP allowlist

## User Secret Structure

Secrets are stored in Secrets Manager with the naming convention: `aws/transfer/users/{username}`

Example secret JSON:
```json
{
  "username": "john.doe",
  "publicKeys": [
    "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC... john.doe@example.com"
  ],
  "role": "arn:aws:iam::123456789012:role/sftp-decrypt-TransferUserRole",
  "homeDirectoryType": "LOGICAL",
  "homeDirectoryMappings": [
    {
      "Entry": "/",
      "Target": "/your-bucket-name/sftp/john.doe"
    }
  ],
  "allowedIPs": ["203.0.113.0/24", "198.51.100.50"]
}
```

## Deployment

```bash
./deploy.sh
```

## Creating User Secrets

After deploying this stack, create user secrets:

```bash
# Create secret from JSON file
aws secretsmanager create-secret \
    --name "aws/transfer/users/john.doe" \
    --secret-string file://user-john-doe.json

# Or create directly
aws secretsmanager create-secret \
    --name "aws/transfer/users/jane.smith" \
    --secret-string '{
      "username": "jane.smith",
      "publicKeys": ["ssh-rsa AAAAB3..."],
      "role": "arn:aws:iam::123456789012:role/sftp-decrypt-userRole",
      "homeDirectoryType": "LOGICAL",
      "homeDirectoryMappings": [
        {
          "Entry": "/",
          "Target": "/bucket-name/sftp/jane.smith"
        }
      ]
    }'
```

## Authentication Flow

1. User initiates SFTP connection
2. Transfer Family invokes this Lambda function with username and source IP
3. Lambda retrieves user config from Secrets Manager
4. Lambda validates:
   - User exists (secret found)
   - Public keys are configured
   - Source IP is allowed (if allowedIPs is configured)
5. Lambda returns user configuration to Transfer Family
6. Transfer Family validates SSH key and grants access

## Features

- **Secrets Manager Integration**: User credentials stored securely
- **Per-user IP Allowlisting**: Optional IP restriction per user
- **Logical Directory Mapping**: Flexible S3 path mapping
- **CloudWatch Logging**: Full audit trail of authentication attempts
- **Error Handling**: Graceful failure for invalid configurations

## Outputs

- `AuthFunctionArn`: Lambda function ARN (used by Transfer server)
- `AuthFunctionName`: Lambda function name
- `AuthFunctionLogGroup`: CloudWatch log group for debugging

## Dependencies

Requires:
- Stack 4-transfer-server to be deployed (for TransferUserRoleArn export)

## Monitoring

View authentication logs:
```bash
aws logs tail /aws/lambda/sftp-decrypt-transfer-auth --follow
```
