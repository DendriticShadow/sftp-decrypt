#!/bin/bash
set -e

# Deploy VPC CloudFormation stack
#
# Usage: ./deploy.sh [stack-name] [project-name] [region]

STACK_NAME=${1:-sftp-decrypt-vpc}
PROJECT_NAME=${2:-sftp-decrypt}
AWS_REGION=${3:-us-east-1}
AWS_PROFILE=${AWS_PROFILE:-teamcity}

echo "=== Deploying VPC Stack ==="
echo "Stack Name: $STACK_NAME"
echo "Project Name: $PROJECT_NAME"
echo "Region: $AWS_REGION"
echo "AWS Profile: $AWS_PROFILE"
echo ""

# Validate template
echo "Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body file://template.yaml \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" > /dev/null

echo "✓ Template is valid"
echo ""

# Deploy stack
echo "Deploying stack..."
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --parameter-overrides \
      ProjectName="$PROJECT_NAME"

echo ""
echo "✓ VPC stack deployed successfully"
echo ""

# Show outputs
echo "Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'Stacks[0].Outputs' \
  --output table
