#!/bin/env bash

set -e
ubuntu_version=$(lsb_release -a 2>/dev/null | grep -v "No LSB modules are available." | grep "Description:" | awk -F "Description:\t" '{print $2}')

# Friendly welcome
echo "🧱 Welcome to the Formbricks single instance installer"
echo ""
echo "🛸 Fasten your seatbelts! We're setting up your Formbricks environment on your $ubuntu_version server."
echo ""

# Remove any old Docker installations, without stopping the script if they're not found
echo "🧹 Time to sweep away any old Docker installations."
sudo apt-get remove docker docker-engine docker.io containerd runc >/dev/null 2>&1 || true

# Update package list
echo "🔄 Updating your package list."
sudo apt-get update >/dev/null 2>&1

# Install dependencies
echo "📦 Installing the necessary dependencies."
sudo apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release >/dev/null 2>&1

# Set up Docker's official GPG key & stable repository
echo "🔑 Adding Docker's official GPG key and setting up the stable repository."
sudo mkdir -m 0755 -p /etc/apt/keyrings >/dev/null 2>&1
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg >/dev/null 2>&1
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null 2>&1

# Update package list again
echo "🔄 Updating your package list again."
sudo apt-get update >/dev/null 2>&1

# Install Docker
echo "🐳 Installing Docker."
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1

# Test Docker installation
echo "🚀 Testing your Docker installation."
if docker --version >/dev/null 2>&1; then
  echo "🎉 Docker is installed!"
else
  echo "❌ Docker is not installed. Please install Docker before proceeding."
  exit 1
fi

# Adding your user to the Docker group
echo "⚙️ Adding your user to the Docker group to avoid using sudo with docker commands."
sudo groupadd docker >/dev/null 2>&1 || true
sudo usermod -aG docker $USER >/dev/null 2>&1

echo "🎉 Hooray! Docker is all set and ready to go. You're now ready to run your Formbricks instance!"

# Installing Traefik
echo "⚙️ Installing Traefik..."
mkdir -p formbricks && cd formbricks
echo "📁 Created Formbricks Quickstart directory at ./formbricks."

# Ask the user for their email address
echo "💡 Please enter your email address for the SSL certificate:"
read email_address

cat <<EOT >traefik.yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"
    http:
      tls:
        certResolver: default
providers:
  docker:
    watch: true
    exposedByDefault: false
certificatesResolvers:
  default:
    acme:
      email: $email_address
      storage: acme.json
      caServer: "https://acme-v01.api.letsencrypt.org/directory"
      tlsChallenge: {}
EOT

echo "💡 Created traefik.yaml file with your provided email address."

touch acme.json
chmod 600 acme.json
echo "💡 Created acme.json file with correct permissions."

# Ask the user for their email address
echo "🔗 Please enter your domain name for the SSL certificate (🚨 do NOT enter the protocol (http/https/etc)):"
read domain_name

cat <<EOT >docker-compose.yml
version: "3.3"
x-environment: &environment
  environment:
    ########################################################################
    # ------------ MANDATORY (CHANGE ACCORDING TO YOUR SETUP) ------------#
    ########################################################################

    # PostgreSQL DB for Formbricks to connect to
    DATABASE_URL: "postgresql://postgres:postgres@postgres:5432/formbricks?schema=public"

    # Uncomment to enable a dedicated connection pool for Prisma using Prisma Data Proxy
    # Cold boots will be faster and you'll be able to scale your DB independently of your app.
    # @see https://www.prisma.io/docs/data-platform/data-proxy/use-data-proxy
    # PRISMA_GENERATE_DATAPROXY=true
    PRISMA_GENERATE_DATAPROXY:

    # NextJS Auth
    # @see: https://next-auth.js.org/configuration/options#nextauth_secret
    # You can use: $(openssl rand -base64 32) to generate one
    NEXTAUTH_SECRET:
    # Set this to your public-facing URL, e.g., https://example.com
    # You do not need the NEXTAUTH_URL environment variable in Vercel.
    NEXTAUTH_URL: "https://$domain_name"

services:
  postgres:
    restart: always
    image: postgres:15-alpine
    volumes:
      - postgres:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=postgres

  formbricks:
    restart: always
    image: formbricks/formbricks:latest
    depends_on:
      - postgres
    labels:
      - "traefik.enable=true"  # Enable Traefik for this service
      - "traefik.http.routers.formbricks.rule=Host(\`$domain_name\`)"  # Replace your_domain_name with your actual domain or IP
      - "traefik.http.routers.formbricks.entrypoints=websecure"  # Use the websecure entrypoint (port 443 with TLS)
      - "traefik.http.services.formbricks.loadbalancer.server.port=3000"  # Forward traffic to Formbricks on port 3000

    ports:
      - 3000:3000
    <<: *environment
  traefik:
    image: "traefik:v2.7"
    restart: always
    container_name: "traefik"
    depends_on:
      - formbricks
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - ./traefik.yaml:/traefik.yaml
      - ./acme.json:/acme.json
      - /var/run/docker.sock:/var/run/docker.sock:ro

volumes:
  postgres:
    driver: local
EOT

update_nextauth_secret() {
  nextauth_secret=$(openssl rand -base64 32)
  sed -i "/NEXTAUTH_SECRET:$/s/NEXTAUTH_SECRET:.\*/NEXTAUTH_SECRET: $nextauth_secret/" docker-compose.yml
}

echo "🚙 Updating NEXTAUTH_SECRET in the Formbricks container..."
while true; do
  if update_nextauth_secret; then
    echo "🚗 NEXTAUTH_SECRET updated successfully!"
    break
  else
    echo "🚧 Failed to update NEXTAUTH_SECRET. Retrying..."
  fi
done

docker compose up -d

echo "🚨 Make sure you have set up the DNS records as well as inbound rules for the domain name and IP address of this instance."
echo ""
echo "🎉 All done! Check the status of Formbricks & Traefik with 'cd formbricks && docker compose ps.'"
