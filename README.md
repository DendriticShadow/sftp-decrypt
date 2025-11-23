# sftp-decrypt

  This was a project inspired from infrastructure I stood up at my current job. The main difference being this uses a fargate instance to handle the decryption process instead of soley existing in AWS Lambda.

  ## Purpose
  - Automated PGP file decryption pipeline using AWS Transfer, Lambda orchestration, and ECS Fargate.

  ## Structure
  - I have my repo separated into 6 CloudFormation stacks. I'm doing this because 1. its easier for me to visualize in my head, 2. I use a self-hosted teamcity server running in docker to deploy my CloudFormation templates to AWS and 3. I like using cross-stack references.
  - Included are deployment scripts you can run using AWS CLI.
  - I have a lot of cost optimizations in place. If you deploy this in your own AWS account I'd recommend tweaking the cron job in the lambda function that stops/starts the SFTP endpoint if not removing it entirely. 
  - Out of all the AWS resources deployed for this project, the SFTP endpoint is the most expensive to leave running. When you aren't using it I highly recommend you turn it off as leaving it on 24/7 will cost you about $230 per month.

  ## Challenges
  - When I started working on this originally, I was buffering the entire encrypted file into memory and then decrypting the file. This is fine for small files but larger files > 1 GB could easily require 5-6 GB of memory. This was not ideal.
  - This was when I discovered streaming decryption. Here the file is fed into memory in chunks, the decrypted chunks are then streamed back to S3, with the stream terminating once it hits EOF (end of file). The default chunk size in the OpenPGP.js is 64 KB, you can tweak this to your hearts content depending on the average size of encrypted files you handle. The higher the chunk size the higher the memory consumption but an added benefit is speed.
  
 ## How this works
 - User connects to SFTP endpoint via SSH. Lambda + Secrets Manager + Transfer authenticates user.
  - I also use an IP allowlist so only IPs on that list can actually connect to the Transfer endpoint. 
 - File uploaded to SFTP → triggers AWS Transfer workflow
 - Workflow invokes Lambda orchestrator
 - Orchestrator checks file size:
 - Worker downloads encrypted file from S3 (streaming)
 - Fetches PGP credentials from Secrets Manager (secret: `aws/transfer/{serverId}/@pgp-default`)
 - Decrypts content using streaming (supports large files)
 - Uploads to `{destinationBucket}/{username}/` (removes .pgp extension)
 - Reports success/failure back to AWS Transfer workflow
 - On failure: File moved to quarantine folder

  ## Deployment Order
  - CloudFormation stacks must be deployed in the correct order due to cross-stack referencing. I have them numbered for that reason.

  ## AWS Services Used
  **Compute:**
  - AWS Lambda - Orchestrator for starting ECS task + user auth
  - ECS Fargate - Container-based decryption
  - ECR - Docker image repository

  **Storage:**
  - S3

  **Networking:**
  - VPC

  **Security:**
  - Secrets Manager - Default PGP key & passphrase + SFTP User secrets for Lambda based Auth

  **Logging:**
  - CloudWatch

  **File Transfer:**
  - AWS Transfer Family

  **IAC:**
  - CloudFormation

## Improvement Roadmap
- add VPC flow logs for network visibility
- enable container insights
- properly scope some IAM wildcards
- add CloudWatch alarms for errors/failures
- Implement Lambda DLQ for failed invocations
- add ECS task health checks and timeouts
- figure out X-Ray tracing