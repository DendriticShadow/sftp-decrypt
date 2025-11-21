#!/bin/bash
set -e

# Deploy Transfer Server CloudFormation stack
#
# Usage: ./deploy.sh [stack-name] [project-name] [region]

STACK_NAME=${1:-sftp-decrypt-transfer}
PROJECT_NAME=${2:-sftp-decrypt}
AWS_REGION=${3:-us-east-1}

echo "=== Deploying Transfer Server Stack ==="
echo "Stack Name: $STACK_NAME"
echo "Project Name: $PROJECT_NAME"
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
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      ProjectName=$PROJECT_NAME

echo ""
echo "✓ Transfer Server stack deployed successfully"
echo ""

# Show outputs
echo "Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs' \
  --output table

echo ""
echo "SFTP Endpoint:"
TRANSFER_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`TransferServerId`].OutputValue' \
  --output text)

echo "  $TRANSFER_ID.server.transfer.$AWS_REGION.amazonaws.com"
