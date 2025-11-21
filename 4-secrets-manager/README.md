# Secrets Manager - PGP Credentials

This component stores PGP private key and passphrase in AWS Secrets Manager.

## Resources Created

- Secrets Manager secret with PGP credentials
- Secret name format: `aws/transfer/{server-id}/@pgp-default`

## Exports

This stack exports the following values:

- `sftp-decrypt-PGPCredentialsSecretArn` - Secret ARN
- `sftp-decrypt-PGPCredentialsSecretName` - Secret name

## Deployment

```bash
./deploy.sh [stack-name] [project-name] [pgp-key-file] [passphrase] [region]
```

Example:
```bash
./deploy.sh sftp-decrypt-secrets sftp-decrypt ./private-key.asc "mypassphrase" us-east-1
```

## Parameters

- `ProjectName` - Project name (default: `sftp-decrypt`)
- `PGPPrivateKey` - PGP private key (ASCII-armored format)
- `PGPPassphrase` - Passphrase for private key

## Generating PGP Keys

If you don't have PGP keys yet:

```bash
# Generate new PGP key pair
gpg --batch --gen-key <<EOF
Key-Type: RSA
Key-Length: 4096
Name-Real: SFTP Decrypt
Name-Email: sftp-decrypt@example.com
Expire-Date: 0
Passphrase: your-secure-passphrase
%commit
EOF

# Export private key (ASCII-armored)
gpg --armor --export-secret-keys sftp-decrypt@example.com > private-key.asc

# Export public key (give to senders)
gpg --armor --export sftp-decrypt@example.com > public-key.asc
```

## Secret Format

The secret is stored as JSON:

```json
{
  "PGPPrivateKey": "-----BEGIN PGP PRIVATE KEY BLOCK-----\n...",
  "PGPPassphrase": "your-passphrase"
}
```

## Dependencies

- **Imports**: `sftp-decrypt-TransferServerId` (from Transfer Server stack)

## Security Considerations

- Secret is encrypted at rest using AWS KMS
- Access controlled via IAM policies
- Automatic rotation not enabled (PGP keys are long-lived)
- Passphrase stored encrypted

## Cost Considerations

- **Secret Storage**: $0.40/month per secret
- **API Calls**: $0.05 per 10,000 API calls

**Total**: ~$0.40/month + negligible API costs
