#!/bin/bash
set -e

# Deploy Secrets Manager CloudFormation stack
#
# Usage: ./deploy.sh [stack-name] [project-name] [pgp-private-key-file] [passphrase] [region]
#
# Example: ./deploy.sh sftp-decrypt-secrets sftp-decrypt /path/to/private.key "mypassphrase" us-east-1

STACK_NAME=${1:-sftp-decrypt-secrets}
PROJECT_NAME=${2:-sftp-decrypt}
PGP_KEY_FILE=${3}
PGP_PASSPHRASE=${4}
AWS_REGION=${5:-us-east-1}
AWS_PROFILE=${AWS_PROFILE:-teamcity}

if [ -z "$PGP_KEY_FILE" ] || [ -z "$PGP_PASSPHRASE" ]; then
  echo "Error: PGP private key file and passphrase are required"
  echo "Usage: $0 <stack-name> <project-name> <pgp-key-file> <passphrase> [region]"
  exit 1
fi

if [ ! -f "$PGP_KEY_FILE" ]; then
  echo "Error: PGP key file not found: $PGP_KEY_FILE"
  exit 1
fi

echo "=== Deploying Secrets Manager Stack ==="
echo "Stack Name: $STACK_NAME"
echo "Project Name: $PROJECT_NAME"
echo "PGP Key File: $PGP_KEY_FILE"
echo "Region: $AWS_REGION"
echo "AWS Profile: $AWS_PROFILE"
echo ""

# Read PGP private key
PGP_PRIVATE_KEY=$(cat "$PGP_KEY_FILE")

# Validate template
echo "Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body file://template.yaml \
  --region $AWS_REGION \
  --profile $AWS_PROFILE > /dev/null

echo "✓ Template is valid"
echo ""

# Create parameter file (for sensitive data)
PARAM_FILE=$(mktemp)
cat > "$PARAM_FILE" <<EOF
[
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "$PROJECT_NAME"
  },
  {
    "ParameterKey": "PGPPrivateKey",
    "ParameterValue": $(echo "$PGP_PRIVATE_KEY" | jq -Rs .)
  },
  {
    "ParameterKey": "PGPPassphrase",
    "ParameterValue": $(echo "$PGP_PASSPHRASE" | jq -Rs .)
  }
]
EOF

# Deploy stack
echo "Deploying stack..."
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --profile $AWS_PROFILE \
  --parameter-overrides file://$PARAM_FILE

# Clean up parameter file
rm -f "$PARAM_FILE"

echo ""
echo "✓ Secrets Manager stack deployed successfully"
echo ""

# Show outputs
echo "Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --profile $AWS_PROFILE \
  --query 'Stacks[0].Outputs' \
  --output table
