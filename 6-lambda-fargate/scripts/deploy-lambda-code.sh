#!/bin/bash
set -e

# Update Lambda orchestrator function code
#
# Usage: ./scripts/deploy-lambda-code.sh <function-name> [region]
#
# Example: ./scripts/deploy-lambda-code.sh pgp-decrypt-stack-orchestrator us-east-1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Updating Lambda Function Code ===${NC}"

# Get parameters
FUNCTION_NAME=${1}
AWS_REGION=${2:-us-east-1}

if [ -z "$FUNCTION_NAME" ]; then
    echo -e "${RED}Error: Function name is required${NC}"
    echo "Usage: $0 <function-name> [region]"
    echo "Example: $0 pgp-decrypt-stack-orchestrator us-east-1"
    exit 1
fi

echo -e "${YELLOW}Function Name: ${FUNCTION_NAME}${NC}"
echo -e "${YELLOW}AWS Region: ${AWS_REGION}${NC}"

# Navigate to project root
cd "$(dirname "$0")/.."

echo -e "${GREEN}Step 1: Building Lambda package${NC}"
./scripts/build-lambda-package.sh

echo -e "${GREEN}Step 2: Updating Lambda function code${NC}"
aws lambda update-function-code \
    --function-name ${FUNCTION_NAME} \
    --zip-file fileb://lambda/lambda-orchestrator.zip \
    --region ${AWS_REGION} > /dev/null

echo -e "${GREEN}Step 3: Waiting for update to complete${NC}"
aws lambda wait function-updated \
    --function-name ${FUNCTION_NAME} \
    --region ${AWS_REGION}

echo -e "${GREEN}=== Lambda Function Updated ===${NC}"
echo -e "${YELLOW}Function: ${FUNCTION_NAME}${NC}"
