#!/bin/bash

set -e

STACK_NAME="sftp-decrypt-transfer-auth"
TEMPLATE_FILE="template.yaml"
REGION="${AWS_REGION:-us-east-1}"

echo "Deploying Transfer Authentication Lambda stack: $STACK_NAME"
echo "Region: $REGION"

aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" \
    --parameter-overrides \
        ProjectName=sftp-decrypt

echo "✅ Deployment complete!"
echo ""
echo "Lambda Function ARN:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`AuthFunctionArn`].OutputValue' \
    --output text
