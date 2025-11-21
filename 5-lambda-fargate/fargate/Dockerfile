# Use official Node.js LTS image (matches Lambda runtime)
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application code
COPY decrypt.js ./

# Create temp directory for file processing
RUN mkdir -p /tmp && chmod 777 /tmp

# Set executable permissions
RUN chmod +x decrypt.js

# Run as non-root user for security
USER node

# Run the decryption script
CMD ["node", "decrypt.js"]
