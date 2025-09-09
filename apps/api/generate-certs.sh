#!/bin/bash

# Generate self-signed SSL certificates for HTTPS
echo "Generating self-signed SSL certificates..."

# Create certs directory
mkdir -p certs

# Generate private key and certificate
openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/C=US/ST=State/L=City/O=QOLA Development/OU=IT Department/CN=localhost"

echo "Certificates generated successfully!"
echo "Key: certs/server.key"
echo "Certificate: certs/server.crt"
echo ""
echo "You can now start the server with HTTPS support."
