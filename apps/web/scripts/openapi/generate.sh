#!/bin/bash

# Script to generate OpenAPI documentation
# This builds the TypeScript file first to avoid module resolution issues

set -e  # Exit on any error

echo "Building OpenAPI document generator..."

# Ensure dist directory exists
mkdir -p dist

# Build the TypeScript file using esbuild
npx esbuild modules/api/v2/openapi-document.ts \
  --bundle \
  --platform=node \
  --outfile=dist/openapi-document.js \
  --external:@prisma/client \
  --external:yaml \
  --external:zod \
  --external:zod-openapi

echo "Generating OpenAPI YAML..."

# Run the built file and output to YAML
dotenv -e ../../.env -- node dist/openapi-document.js > ../../docs/api-v2-reference/openapi.yml

echo "OpenAPI documentation generated successfully at docs/api-v2-reference/openapi.yml" 