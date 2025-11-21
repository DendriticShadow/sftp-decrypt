#!/bin/bash
set -e

# Deploy Transfer Workflow CloudFormation stack
#
# Usage: ./deploy.sh [stack-name] [project-name] [region]

STACK_NAME=${1:-sftp-decrypt-workflow}
PROJECT_NAME=${2:-sftp-decrypt}
AWS_REGION=${3:-us-east-1}

echo "=== Deploying Transfer Workflow Stack ==="
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
  --parameter-overrides \
      ProjectName=$PROJECT_NAME

echo ""
echo "✓ Transfer Workflow stack deployed successfully"
echo ""

# Show outputs
echo "Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs' \
  --output table
