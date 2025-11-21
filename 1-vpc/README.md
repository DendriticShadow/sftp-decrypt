# VPC Infrastructure

This component creates the VPC infrastructure for the SFTP decrypt solution.

## Resources Created

- VPC with DNS support enabled
- 2 Public subnets (for NAT Gateways)
- 2 Private subnets (for Fargate tasks)
- Internet Gateway
- 2 NAT Gateways (high availability)
- Route tables and associations
- VPC Endpoints (S3, ECR, Secrets Manager) to reduce NAT costs

## Exports

This stack exports the following values for use by other stacks:

- `sftp-decrypt-VpcId` - VPC ID
- `sftp-decrypt-VpcCidr` - VPC CIDR block
- `sftp-decrypt-PrivateSubnet1Id` - Private subnet 1 ID
- `sftp-decrypt-PrivateSubnet2Id` - Private subnet 2 ID
- `sftp-decrypt-PrivateSubnetIds` - Comma-separated private subnet IDs
- `sftp-decrypt-PublicSubnet1Id` - Public subnet 1 ID
- `sftp-decrypt-PublicSubnet2Id` - Public subnet 2 ID

## Deployment

```bash
./deploy.sh [stack-name] [project-name] [region]
```

Example:
```bash
./deploy.sh sftp-decrypt-vpc sftp-decrypt us-east-1
```

## Parameters

- `ProjectName` - Project name for resource naming (default: `sftp-decrypt`)
- `VpcCidr` - VPC CIDR block (default: `10.0.0.0/16`)
- `PrivateSubnet1Cidr` - Private subnet 1 CIDR (default: `10.0.1.0/24`)
- `PrivateSubnet2Cidr` - Private subnet 2 CIDR (default: `10.0.2.0/24`)
- `PublicSubnet1Cidr` - Public subnet 1 CIDR (default: `10.0.101.0/24`)
- `PublicSubnet2Cidr` - Public subnet 2 CIDR (default: `10.0.102.0/24`)

## Dependencies

None - This is a foundational component

## Cost Considerations

- **NAT Gateways**: ~$0.045/hour each × 2 = ~$65/month
- **Data Transfer**: $0.045/GB processed through NAT Gateway
- **VPC Endpoints**: No hourly charge for Gateway endpoints (S3)
- **VPC Endpoints**: ~$0.01/hour for Interface endpoints × 3 = ~$22/month

**Total**: ~$87/month + data transfer costs

### Cost Optimization

Consider using a single NAT Gateway for dev/test environments.
