# VPC Infrastructure

This CloudFormation template creates the foundational VPC infrastructure for the SFTP decrypt solution.

## Resources Created

- **VPC** - 10.0.0.0/16 CIDR with DNS support enabled
- **Public Subnet** - 10.0.1.0/24 in a single availability zone
- **Internet Gateway** - Provides internet access for the public subnet
- **Route Table** - Routes traffic to the Internet Gateway
- **S3 Gateway VPC Endpoint** - Private access to S3 without data transfer charges

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| ProjectName | `sftp-decrypt` | Project name used for resource naming and tagging |
| VpcCidr | `10.0.0.0/16` | CIDR block for the VPC |
| PublicSubnet1Cidr | `10.0.1.0/24` | CIDR block for the public subnet |

## Outputs

The stack exports these values for use by other stacks:

| Export Name | Description |
|-------------|-------------|
| `sftp-decrypt-VpcId` | VPC ID |
| `sftp-decrypt-VpcCidr` | VPC CIDR block |
| `sftp-decrypt-PublicSubnet1Id` | Public subnet ID |
| `sftp-decrypt-PrivateSubnetIds` | Subnet for Fargate tasks (references public subnet for compatibility) |
| `sftp-decrypt-PrivateSubnet1Id` | Subnet for Fargate tasks (references public subnet for compatibility) |

## Deployment

```bash
./deploy.sh [stack-name] [project-name] [region]
```

Example:
```bash
./deploy.sh sftp-decrypt-vpc sftp-decrypt us-east-1
```

The deploy script uses the AWS CLI profile specified by the `AWS_PROFILE` environment variable (default: `teamcity`).
# Testing teamcity auto trigger
