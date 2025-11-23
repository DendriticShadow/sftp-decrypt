#!/bin/bash
set -e

# Build and push Fargate Docker image to ECR
#
# Usage: ./scripts/build-fargate-image.sh [ecr-repo-uri] [region]
#
# Example: ./scripts/build-fargate-image.sh 123456789012.dkr.ecr.us-east-1.amazonaws.com/pgp-decrypt us-east-1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Building Fargate Docker Image ===${NC}"

# Get parameters
ECR_REPO_URI=${1}
AWS_REGION=${2:-us-east-1}

if [ -z "$ECR_REPO_URI" ]; then
    echo -e "${RED}Error: ECR repository URI is required${NC}"
    echo "Usage: $0 <ecr-repo-uri> [region]"
    echo "Example: $0 123456789012.dkr.ecr.us-east-1.amazonaws.com/pgp-decrypt us-east-1"
    exit 1
fi

# Extract account ID and repository name from URI
ACCOUNT_ID=$(echo $ECR_REPO_URI | cut -d'.' -f1)
REPO_NAME=$(echo $ECR_REPO_URI | cut -d'/' -f2)

echo -e "${YELLOW}ECR Repository: ${ECR_REPO_URI}${NC}"
echo -e "${YELLOW}AWS Region: ${AWS_REGION}${NC}"
echo -e "${YELLOW}Account ID: ${ACCOUNT_ID}${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Navigate to fargate directory
cd "$(dirname "$0")/../fargate"

echo -e "${GREEN}Step 1: Installing dependencies${NC}"
npm install --production

echo -e "${GREEN}Step 2: Building Docker image${NC}"
docker build -t pgp-decrypt:latest .

echo -e "${GREEN}Step 3: Tagging image for ECR${NC}"
docker tag pgp-decrypt:latest ${ECR_REPO_URI}:latest
docker tag pgp-decrypt:latest ${ECR_REPO_URI}:$(date +%Y%m%d-%H%M%S)

echo -e "${GREEN}Step 4: Authenticating with ECR${NC}"
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo -e "${GREEN}Step 5: Pushing image to ECR${NC}"
docker push ${ECR_REPO_URI}:latest
docker push ${ECR_REPO_URI}:$(date +%Y%m%d-%H%M%S)

echo -e "${GREEN}=== Build Complete ===${NC}"
echo -e "${GREEN}Image URI: ${ECR_REPO_URI}:latest${NC}"
