#!/bin/bash

# Script to generate OpenAPI documentation
# This builds the TypeScript file first to avoid module resolution issues

set -e  # Exit on any error

echo "Building OpenAPI document generator..."

# Ensure dist directory exists
mkdir -p dist

# Build using the permanent vite config
vite build --config scripts/openapi/vite.config.ts

echo "Generating OpenAPI YAML..."

# Run the built file and output to YAML
dotenv -e ../../.env -- node dist/openapi-document.js > ../../docs/api-v2-reference/openapi.yml

echo "OpenAPI documentation generated successfully at docs/api-v2-reference/openapi.yml" 