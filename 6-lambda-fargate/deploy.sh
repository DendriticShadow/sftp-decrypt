#!/bin/bash
set -e

# Deploy Lambda + Fargate CloudFormation stack with Docker image build
#
# Usage: ./deploy.sh [stack-name] [project-name] [region]

STACK_NAME=${1:-sftp-decrypt-lambda-fargate}
PROJECT_NAME=${2:-sftp-decrypt}
AWS_REGION=${3:-us-east-1}
AWS_PROFILE=${AWS_PROFILE:-teamcity}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Deploying Lambda + Fargate Stack ==="
echo "Stack Name: $STACK_NAME"
echo "Project Name: $PROJECT_NAME"
echo "Region: $AWS_REGION"
echo "AWS Profile: $AWS_PROFILE"
echo ""

# Validate template
echo "Step 1: Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body file://$SCRIPT_DIR/template.yaml \
  --region $AWS_REGION \
  --profile $AWS_PROFILE > /dev/null

echo "✓ Template is valid"
echo ""

# Deploy initial infrastructure with placeholder image
echo "Step 2: Deploying initial infrastructure..."
PLACEHOLDER_IMAGE="public.ecr.aws/docker/library/node:20-slim"

aws cloudformation deploy \
  --template-file $SCRIPT_DIR/template.yaml \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --profile $AWS_PROFILE \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      ProjectName=$PROJECT_NAME \
      ContainerImage=$PLACEHOLDER_IMAGE

echo "✓ Initial infrastructure deployed"
echo ""

# Get ECR repository URI
echo "Step 3: Getting ECR repository URI..."
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --profile $AWS_PROFILE \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' \
  --output text)

echo "ECR Repository: $ECR_URI"
echo ""

# Build and push Docker image
echo "Step 4: Building and pushing Docker image..."
$SCRIPT_DIR/scripts/build-fargate-image.sh $ECR_URI $AWS_REGION $AWS_PROFILE

echo ""

# Update infrastructure with real image
echo "Step 5: Updating infrastructure with Docker image..."
aws cloudformation deploy \
  --template-file $SCRIPT_DIR/template.yaml \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --profile $AWS_PROFILE \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      ProjectName=$PROJECT_NAME \
      ContainerImage=$ECR_URI:latest

echo "✓ Infrastructure updated with container image"
echo ""

# Deploy Lambda code
echo "Step 6: Deploying Lambda function code..."
LAMBDA_FUNCTION=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --profile $AWS_PROFILE \
  --query 'Stacks[0].Outputs[?OutputKey==`OrchestratorFunctionName`].OutputValue' \
  --output text)

$SCRIPT_DIR/scripts/deploy-lambda-code.sh $LAMBDA_FUNCTION $AWS_REGION $AWS_PROFILE

echo ""
echo "✓ Lambda + Fargate stack deployed successfully"
echo ""

# Show outputs
echo "Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --profile $AWS_PROFILE \
  --query 'Stacks[0].Outputs' \
  --output table
