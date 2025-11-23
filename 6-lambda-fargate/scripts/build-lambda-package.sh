#!/bin/bash
set -e

# Build Lambda deployment package for orchestrator
#
# Usage: ./scripts/build-lambda-package.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Building Lambda Deployment Package ===${NC}"

# Navigate to lambda directory
cd "$(dirname "$0")/../lambda"

echo -e "${GREEN}Step 1: Installing dependencies${NC}"
rm -rf node_modules package-lock.json
npm install --production

echo -e "${GREEN}Step 2: Creating deployment package${NC}"
rm -f lambda-orchestrator.zip

# Create zip with orchestrator.js as index.js (Lambda expects index.handler)
cp orchestrator.js index.js
zip -r lambda-orchestrator.zip index.js node_modules/
rm index.js

# Get package size
PACKAGE_SIZE=$(du -h lambda-orchestrator.zip | cut -f1)
echo -e "${GREEN}Package created: lambda-orchestrator.zip (${PACKAGE_SIZE})${NC}"

echo -e "${GREEN}=== Build Complete ===${NC}"
echo -e "${YELLOW}Deployment package: lambda/lambda-orchestrator.zip${NC}"
