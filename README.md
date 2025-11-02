# sftp-decrypt
  This is an AWS Lambda function that automatically decrypts PGP-encrypted files uploaded via AWS Transfer Family
  SFTP service.

  Purpose

  - Receives PGP-encrypted files from SFTP uploads
  - Retrieves decryption credentials from AWS Secrets Manager
  - Decrypts files using OpenPGP cryptography
  - Stores decrypted files back to S3
  - Integrates with AWS Transfer workflow system

  Structure

  The codebase is intentionally minimal:
  - Single file: index.js (387 lines) - contains all logic
  - No dependencies in repo: Uses AWS SDK v3 and openpgp library (managed at Lambda layer level)
  - No build system: Direct Node.js Lambda deployment

  Key Components

  Main Handler (index.js)
  - AWS Lambda entry point that orchestrates the entire workflow

  Core Functions:
  1. extractPathComponents() - Parses S3 paths to extract username from in/sftp/{username}/... format
  2. getPGPCredentials() - Retrieves PGP private key and passphrase from Secrets Manager
  3. streamToBuffer() - Converts S3 streams to buffers
  4. decryptPGPContent() - Core decryption logic supporting both ASCII-armored and binary PGP formats

  Workflow

  1. File uploaded to SFTP → triggers Lambda via AWS Transfer workflow
  2. Downloads encrypted file from S3
  3. Fetches PGP credentials from Secrets Manager (secret name: aws/transfer/{serverId}/@pgp-default)
  4. Decrypts content
  5. Uploads to in/decrypted/{username}/ (removes .pgp extension)
  6. Reports success/failure back to AWS Transfer

  Technologies

  - Node.js runtime
  - AWS SDK v3 (S3, Secrets Manager, Transfer)
  - OpenPGP library for encryption
  - Integrated with AWS Transfer Family workflows

  The project is focused and production-ready for its specific use case of automated PGP decryption in SFTP
  workflows.
