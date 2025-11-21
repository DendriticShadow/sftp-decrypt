#!/bin/bash
set -e

# Deploy S3 Buckets CloudFormation stack
#
# Usage: ./deploy.sh [stack-name] [project-name] [source-bucket] [dest-bucket] [region]

STACK_NAME=${1:-sftp-decrypt-s3}
PROJECT_NAME=${2:-sftp-decrypt}
SOURCE_BUCKET=${3:-my-sftp-bucket}
DEST_BUCKET=${4:-my-sftp-bucket}
AWS_REGION=${5:-us-east-1}

echo "=== Deploying S3 Buckets Stack ==="
echo "Stack Name: $STACK_NAME"
echo "Project Name: $PROJECT_NAME"
echo "Source Bucket: $SOURCE_BUCKET"
echo "Destination Bucket: $DEST_BUCKET"
echo "Region: $AWS_REGION"
echo ""

# Validate template
echo "Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body file://template.yaml \
  --region $AWS_REGION > /dev/null

echo "✓ Template is valid"
echo ""

# Deploy stack
echo "Deploying stack..."
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --parameter-overrides \
      ProjectName=$PROJECT_NAME \
      SourceBucketName=$SOURCE_BUCKET \
      DestinationBucketName=$DEST_BUCKET

echo ""
echo "✓ S3 Buckets stack deployed successfully"
echo ""

# Show outputs
echo "Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs' \
  --output table
