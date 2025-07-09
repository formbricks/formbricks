#!/bin/bash

# Script to generate OpenAPI documentation
# This builds the TypeScript file first to avoid module resolution issues

set -e  # Exit on any error

# Change to script's directory to make it location-agnostic
cd "$(dirname "$0")"

echo "Building OpenAPI document generator..."

# Ensure dist directory exists (relative to apps/web)
mkdir -p ../../dist

# Build using the permanent vite config (from apps/web directory)
cd ../../
vite build --config scripts/openapi/vite.config.ts

echo "Generating OpenAPI YAML..."

# Run the built file and output to YAML
dotenv -e ../../.env -- node dist/openapi-document.js > ../../docs/api-v2-reference/openapi.yml

echo "OpenAPI documentation generated successfully at docs/api-v2-reference/openapi.yml" 