#!/bin/bash

# Docker Quick Start Script for Formbricks with Snowflake Integration
# This script helps you set up and run Formbricks in Docker with all your Snowflake credentials

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Formbricks Docker Setup with Snowflake Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

# Check if .env.docker exists
if [ ! -f .env.docker ]; then
    echo -e "${YELLOW}📋 Creating .env.docker file...${NC}"

    # Generate secrets
    echo -e "${BLUE}🔐 Generating secure secrets...${NC}"
    cat > .env.docker << EOF
# Auto-generated secrets
NEXTAUTH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
MEMBER_LOOKUP_API_KEY=$(openssl rand -base64 32)

# Snowflake Connection (FILL THESE IN!)
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USERNAME=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_DATABASE=
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=
EOF

    echo -e "${GREEN}✅ .env.docker created with generated secrets${NC}"
    echo -e "${YELLOW}⚠️  You need to add your Snowflake credentials!${NC}"
    echo -e "${YELLOW}   Edit .env.docker and fill in the SNOWFLAKE_* variables${NC}"
    echo ""
    read -p "Press Enter after you've added your Snowflake credentials..."
fi

# Verify Snowflake credentials are set
echo -e "${BLUE}🔍 Checking Snowflake credentials...${NC}"

MISSING_VARS=()

for var in SNOWFLAKE_ACCOUNT SNOWFLAKE_USERNAME SNOWFLAKE_PASSWORD SNOWFLAKE_DATABASE SNOWFLAKE_WAREHOUSE; do
    if ! grep -q "^${var}=.\\+" .env.docker; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing Snowflake credentials:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${RED}   - $var${NC}"
    done
    echo ""
    echo -e "${YELLOW}Please edit .env.docker and add the missing credentials${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All Snowflake credentials found${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo -e "${YELLOW}Please start Docker Desktop and try again${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Ask what to do
echo -e "${BLUE}What would you like to do?${NC}"
echo "1) Build and start all services"
echo "2) Start services (already built)"
echo "3) Stop services"
echo "4) View logs"
echo "5) Clean restart (removes all data)"
echo "6) Exit"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo -e "${BLUE}🔨 Building Docker images...${NC}"
        docker-compose -f docker-compose.local.yml build

        echo -e "${BLUE}🚀 Starting all services...${NC}"
        docker-compose --env-file .env.docker -f docker-compose.local.yml up -d

        echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
        sleep 10

        echo -e "${BLUE}📊 Running database migrations...${NC}"
        docker-compose -f docker-compose.local.yml exec -T formbricks pnpm --filter=@formbricks/web db:migrate:deploy || true

        echo ""
        echo -e "${GREEN}✅ Formbricks is running!${NC}"
        echo ""
        echo -e "${BLUE}Access your services:${NC}"
        echo -e "  🌐 Formbricks:  ${GREEN}http://localhost:3000${NC}"
        echo -e "  📧 MailHog UI:  ${GREEN}http://localhost:8025${NC}"
        echo -e "  📦 MinIO:       ${GREEN}http://localhost:9001${NC}"
        echo ""
        echo -e "${YELLOW}View logs with: docker-compose -f docker-compose.local.yml logs -f${NC}"
        ;;

    2)
        echo -e "${BLUE}🚀 Starting services...${NC}"
        docker-compose --env-file .env.docker -f docker-compose.local.yml up -d

        echo -e "${GREEN}✅ Services started${NC}"
        echo -e "  🌐 Formbricks: http://localhost:3000"
        ;;

    3)
        echo -e "${BLUE}🛑 Stopping services...${NC}"
        docker-compose -f docker-compose.local.yml down
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;

    4)
        echo -e "${BLUE}📋 Showing logs (Ctrl+C to exit)...${NC}"
        docker-compose -f docker-compose.local.yml logs -f
        ;;

    5)
        echo -e "${YELLOW}⚠️  This will delete all data (database, uploads, etc.)${NC}"
        read -p "Are you sure? (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            echo -e "${BLUE}🗑️  Removing all containers and volumes...${NC}"
            docker-compose -f docker-compose.local.yml down -v
            echo -e "${GREEN}✅ Clean restart complete${NC}"
            echo -e "${YELLOW}Run this script again to start fresh${NC}"
        else
            echo -e "${YELLOW}Cancelled${NC}"
        fi
        ;;

    6)
        echo -e "${BLUE}Goodbye!${NC}"
        exit 0
        ;;

    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
