# S3 Buckets

This component creates S3 buckets for encrypted and decrypted files.

## Resources Created

- Source S3 bucket (for encrypted files from SFTP)
- Destination S3 bucket (for decrypted files) - optional, can use same bucket
- Bucket policies enforcing encryption and secure transport
- Lifecycle rules for archival and cleanup

## Exports

This stack exports the following values:

- `sftp-decrypt-SourceBucketName` - Source bucket name
- `sftp-decrypt-SourceBucketArn` - Source bucket ARN
- `sftp-decrypt-DestinationBucketName` - Destination bucket name
- `sftp-decrypt-DestinationBucketArn` - Destination bucket ARN

## Deployment

```bash
./deploy.sh [stack-name] [project-name] [source-bucket] [dest-bucket] [region]
```

Example - Same bucket for source and destination:
```bash
./deploy.sh sftp-decrypt-s3 sftp-decrypt my-sftp-bucket my-sftp-bucket us-east-1
```

Example - Separate buckets:
```bash
./deploy.sh sftp-decrypt-s3 sftp-decrypt sftp-encrypted sftp-decrypted us-east-1
```

## Parameters

- `ProjectName` - Project name (default: `sftp-decrypt`)
- `SourceBucketName` - Name for source bucket (required)
- `DestinationBucketName` - Name for destination bucket (required)
- `EnableVersioning` - Enable versioning (default: `true`)
- `RetentionDays` - Days to retain files (default: `30`)

## Bucket Structure

```
my-sftp-bucket/
├── in/sftp/{username}/          # Encrypted files uploaded via SFTP
├── in/decrypted/{username}/     # Decrypted files
└── quarantine/{username}/       # Failed decryption files
```

## Dependencies

None - This is a foundational component

## Security Features

- Server-side encryption (AES256) enforced
- Public access blocked
- SSL/TLS transport enforced
- Versioning enabled (optional)

## Cost Considerations

- **Storage**: $0.023/GB/month (Standard)
- **Requests**: Minimal (PUT/GET operations)
- **Lifecycle transitions**: Files moved to Glacier after retention period

**Example**: 100 GB average storage = ~$2.30/month
