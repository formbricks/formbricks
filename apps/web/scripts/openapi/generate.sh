#!/bin/bash

# Script to generate OpenAPI documentation
# This builds the TypeScript file first to avoid module resolution issues

set -e  # Exit on any error

# Get script directory and compute project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
APPS_WEB_DIR="$PROJECT_ROOT/apps/web"

echo "Building OpenAPI document generator..."

# Build using the permanent vite config (from apps/web directory)
cd "$APPS_WEB_DIR"
vite build --config scripts/openapi/vite.config.ts

echo "Generating OpenAPI YAML..."

# Run the built file and output to YAML
dotenv -e "$PROJECT_ROOT/.env" -- node dist/openapi-document.js > "$PROJECT_ROOT/docs/api-v2-reference/openapi.yml"

echo "OpenAPI documentation generated successfully at docs/api-v2-reference/openapi.yml" 