# S3 Buckets

This CloudFormation template creates S3 buckets for storing encrypted files uploaded via SFTP and the resulting decrypted files.

## Resources Created

**Source Bucket** - Stores encrypted PGP files uploaded via AWS Transfer Family SFTP
- Used by SFTP users to upload encrypted files to `/in/sftp/{username}/` paths
- Transfer Family workflow triggers decryption when files arrive
- Quarantine path (`/quarantine/{username}/`) for files that fail decryption

**Destination Bucket** (conditional) - Stores decrypted files after processing
- Created only if you specify a different name than the source bucket
- If source and destination names are the same, both paths exist in one bucket
- Fargate tasks write decrypted files here

**Security Features:**
- Server-side encryption (AES256) enabled on all buckets
- Versioning enabled to protect against accidental deletion
- Public access completely blocked
- Access controlled through IAM roles (no bucket policies)

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| ProjectName | No | Project name used for resource naming (default: `sftp-decrypt`) |
| SourceBucketName | Yes | Name for the bucket receiving encrypted SFTP uploads |
| DestinationBucketName | Yes | Name for the bucket storing decrypted files (can be same as source) |

## Outputs

The stack exports these values for use by other stacks:

| Export Name | Description |
|-------------|-------------|
| `sftp-decrypt-SourceBucketName` | Source bucket name |
| `sftp-decrypt-SourceBucketArn` | Source bucket ARN (for IAM policies) |
| `sftp-decrypt-DestinationBucketName` | Destination bucket name |
| `sftp-decrypt-DestinationBucketArn` | Destination bucket ARN (for IAM policies) |

## Deployment

```bash
./deploy.sh [stack-name] [project-name] [source-bucket] [dest-bucket] [region]
```

**Example - Same bucket for source and destination:**
```bash
./deploy.sh sftp-decrypt-s3 sftp-decrypt my-sftp-bucket my-sftp-bucket us-east-1
```

**Example - Separate buckets:**
```bash
./deploy.sh sftp-decrypt-s3 sftp-decrypt sftp-source-bucket sftp-dest-bucket us-east-1
```

The deploy script uses the AWS CLI profile specified by the `AWS_PROFILE` environment variable (default: `teamcity`).
