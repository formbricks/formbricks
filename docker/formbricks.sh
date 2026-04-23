#!/bin/env bash

set -e
ubuntu_version=$(lsb_release -a 2>/dev/null | grep -v "No LSB modules are available." | grep "Description:" | awk -F "Description:\t" '{print $2}')

write_rustfs_init_script() {
  local target_path="${1:-rustfs-init.sh}"
  local script_dir
  local template_path

  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  template_path="${script_dir}/rustfs-init.sh"

  if [ -f "$template_path" ]; then
    cp "$template_path" "$target_path"
    chmod +x "$target_path"
    return
  fi

  cat >"$target_path" << 'RUSTFS_SCRIPT_EOF'
#!/bin/sh
# Shared RustFS bootstrap script.
# Used directly by docker-compose.dev.yml for local development and used as the
# source template for the generated rustfs-init.sh in docker/formbricks.sh for
# one-click/self-hosted installs. packages/storage/src/rustfs-init-bootstrap.test.ts
# also validates that the generated script stays in sync with this file.
set -e
rustfs_endpoint_url="${RUSTFS_ENDPOINT_URL:-http://rustfs:9000}"
echo '⏳ Waiting for RustFS to be ready...'
attempts=0
max_attempts=30
until mc alias set rustfs "$rustfs_endpoint_url" "$RUSTFS_ADMIN_USER" "$RUSTFS_ADMIN_PASSWORD" >/dev/null 2>&1 \
  && mc ls rustfs >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ $attempts -ge $max_attempts ]; then
    printf '❌ Failed to connect to RustFS after %s attempts\n' $max_attempts
    exit 1
  fi
  printf '...still waiting attempt %s/%s\n' $attempts $max_attempts
  sleep 2
done
echo '🔗 RustFS reachable; alias configured.'

echo '🪣 Creating bucket (idempotent)...'
mc mb rustfs/$RUSTFS_BUCKET_NAME --ignore-existing

if [ -n "${RUSTFS_CORS_ALLOWED_ORIGINS:-}" ]; then
  echo '🌐 Applying bucket CORS configuration...'
  cors_file="/tmp/formbricks-cors.xml"

  cat > "$cors_file" << EOF
<CORSConfiguration>
  <CORSRule>
EOF

  old_ifs=$IFS
  IFS=','
  for origin in $RUSTFS_CORS_ALLOWED_ORIGINS; do
    trimmed_origin=$(printf '%s' "$origin" | tr -d '[:space:]')
    if [ -n "$trimmed_origin" ]; then
      printf '    <AllowedOrigin>%s</AllowedOrigin>\n' "$trimmed_origin" >> "$cors_file"
    fi
  done
  IFS=$old_ifs

  cat >> "$cors_file" << EOF
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
EOF

  mc cors set rustfs/$RUSTFS_BUCKET_NAME "$cors_file"
  echo 'CORS configuration applied successfully.'
fi

echo '📄 Creating JSON policy file...'
cat > /tmp/formbricks-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::$RUSTFS_BUCKET_NAME/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::$RUSTFS_BUCKET_NAME"]
    }
  ]
}
EOF

echo '🔒 Creating policy (idempotent)...'
if ! mc admin policy info rustfs "$RUSTFS_POLICY_NAME" >/dev/null 2>&1; then
  mc admin policy create rustfs "$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json || \
    mc admin policy add rustfs "$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json
  echo 'Policy created successfully.'
else
  echo 'Policy already exists, skipping creation.'
fi

echo '👤 Creating service user (idempotent)...'
if ! mc admin user info rustfs "$RUSTFS_SERVICE_USER" >/dev/null 2>&1; then
  mc admin user add rustfs "$RUSTFS_SERVICE_USER" "$RUSTFS_SERVICE_PASSWORD"
  echo 'User created successfully.'
else
  echo 'User already exists, skipping creation.'
fi

echo '🔗 Attaching policy to user (idempotent)...'
mc admin policy attach rustfs "$RUSTFS_POLICY_NAME" --user "$RUSTFS_SERVICE_USER"

echo '✅ RustFS setup complete!'
RUSTFS_SCRIPT_EOF

  chmod +x "$target_path"
}

upsert_dotenv_var() {
  local key="$1"
  local value="$2"
  local env_file="${3:-.env}"
  local tmp_file

  touch "$env_file"
  chmod 600 "$env_file"
  tmp_file=$(mktemp)

  awk -v insert_key="$key" -v insert_val="$value" '
    BEGIN { updated=0 }
    $0 ~ "^" insert_key "=" {
      print insert_key "=" insert_val
      updated=1
      next
    }
    { print }
    END {
      if (!updated) {
        print insert_key "=" insert_val
      }
    }
  ' "$env_file" >"$tmp_file" && mv "$tmp_file" "$env_file"
}

write_rustfs_env_file() {
  local env_file="${1:-.env}"

  upsert_dotenv_var "FORMBRICKS_RUSTFS_ADMIN_USER" "$rustfs_admin_user" "$env_file"
  upsert_dotenv_var "FORMBRICKS_RUSTFS_ADMIN_PASSWORD" "$rustfs_admin_password" "$env_file"
  upsert_dotenv_var "FORMBRICKS_RUSTFS_SERVICE_USER" "$rustfs_service_user" "$env_file"
  upsert_dotenv_var "FORMBRICKS_RUSTFS_SERVICE_PASSWORD" "$rustfs_service_password" "$env_file"
  upsert_dotenv_var "FORMBRICKS_RUSTFS_BUCKET_NAME" "$rustfs_bucket_name" "$env_file"
  upsert_dotenv_var "FORMBRICKS_RUSTFS_POLICY_NAME" "$rustfs_policy_name" "$env_file"
  upsert_dotenv_var "FORMBRICKS_RUSTFS_REGION" "us-east-1" "$env_file"
}

install_formbricks() {
  # Friendly welcome
  echo "🧱 Welcome to the Formbricks Setup Script"
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
  echo "🐳 Adding your user to the Docker group to avoid using sudo with docker commands."
  sudo groupadd docker >/dev/null 2>&1 || true
  sudo usermod -aG docker $USER >/dev/null 2>&1

  echo "🎉 Hooray! Docker is all set and ready to go. You're now ready to run your Formbricks instance!"

  mkdir -p formbricks && cd formbricks
  echo "📁 Created Formbricks Quickstart directory at ./formbricks."

  # Ask the user for their domain name (recommend surveys subdomain)
  echo "🔗 Please enter your app domain (e.g., surveys.example.com). 🚨 Do NOT enter the protocol (http/https):"
  read domain_name

  echo "🔗 Do you want us to set up an HTTPS certificate for you? [Y/n]"
  read https_setup
  https_setup=$(echo "$https_setup" | tr '[:upper:]' '[:lower:]')

  # Set default value for HTTPS setup
  if [[ -z $https_setup ]]; then
    https_setup="y"
  fi

  if [[ $https_setup == "y" ]]; then
    echo "🔗 Please make sure that the domain points to the server's IP address and that ports 80 & 443 are open in your server's firewall. Is everything set up? [Y/n]"
    read dns_setup
    dns_setup=$(echo "$dns_setup" | tr '[:upper:]' '[:lower:]')

    # Set default value for DNS setup
    if [[ -z $dns_setup ]]; then
      dns_setup="y"
    fi

    if [[ $dns_setup == "y" ]]; then
      echo "💡 Please enter your email address for the SSL certificate:"
      read email_address

      echo "🔗 Do you want to enforce HTTPS (HSTS)? [Y/n]"
      read hsts_enabled
      hsts_enabled=$(echo "$hsts_enabled" | tr '[:upper:]' '[:lower:]')

      #  Set default value for HSTS
      if [[ -z $hsts_enabled ]]; then
        hsts_enabled="y"
      fi

    else
      echo "❌ Ports 80 & 443 are not open. We can't help you in providing the SSL certificate."
      https_setup="n"
      hsts_enabled="n"
    fi
  else
    https_setup="n"
    hsts_enabled="n"
  fi

  # Ask for HSTS configuration for HTTPS redirection if custom certificate is used
  if [[ $https_setup == "n" ]]; then
    echo "You have chosen not to set up HTTPS certificate for your domain. Please make sure to set up HTTPS on your own. You can refer to the Formbricks documentation(https://formbricks.com/docs/self-hosting/custom-ssl) for more information."

    echo "🔗 Do you want to enforce HTTPS (HSTS)? [Y/n]"
    read hsts_enabled
    hsts_enabled=$(echo "$hsts_enabled" | tr '[:upper:]' '[:lower:]')

    #  Set default value for HSTS
    if [[ -z $hsts_enabled ]]; then
      hsts_enabled="y"
    fi
  fi

  # Installing Traefik
  echo "🚗 Configuring Traefik..."

  if [[ $hsts_enabled == "y" ]]; then
    hsts_middlewares="middlewares:
        - hstsHeader"
    http_redirection="http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true"
  else
    hsts_middlewares=""
    http_redirection=""
  fi

  if [[ $https_setup == "y" ]]; then
    certResolver="certResolver: default"
    certificates_resolvers="certificatesResolvers:
  default:
    acme:
      email: $email_address
      storage: acme.json
      caServer: "https://acme-v02.api.letsencrypt.org/directory"
      tlsChallenge: {}"
  else
    certResolver=""
    certificates_resolvers=""
  fi

  cat <<EOT >traefik.yaml
entryPoints:
  web:
    address: ":80"
    $http_redirection
    transport:
      respondingTimeouts:
        readTimeout: 60s
  websecure:
    address: ":443"
    transport:
      respondingTimeouts:
        readTimeout: 60s
    http:
      tls:
        $certResolver
        options: default
      $hsts_middlewares
providers:
  docker:
    watch: true
    exposedByDefault: false
  file:
    directory: /
$certificates_resolvers
EOT

  cat <<EOT >traefik-dynamic.yaml
# configuring min TLS version
tls:
  options:
    default:
      minVersion: VersionTLS12
      cipherSuites:
        # TLS 1.2 strong ciphers
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
        - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
        - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256
        # TLS 1.3 ciphers are not configurable in Traefik; they are enabled by default
      curvePreferences:
        - CurveP521
        - CurveP384
      sniStrict: true
      alpnProtocols:
        - h2
        - http/1.1
        - acme-tls/1
EOT

  echo "💡 Created traefik.yaml and traefik-dynamic.yaml file."

  if [[ $https_setup == "y" ]]; then
    touch acme.json
    chmod 600 acme.json
    echo "💡 Created acme.json file with correct permissions."
  fi

  # Prompt for email service setup
  read -p "📧 Do you want to set up the email service? You will need SMTP credentials for the same! [y/N]" email_service
  email_service=$(echo "$email_service" | tr '[:upper:]' '[:lower:]')

  # Set default value for email service setup
  if [[ -z $email_service ]]; then
    email_service="n"
  fi

  if [[ $email_service == "y" ]]; then
    echo "Please provide the following email service details: "

    echo -n "Enter your SMTP configured Email ID: "
    read mail_from

    echo -n "Enter your SMTP configured Email Name: "
    read mail_from_name

    echo -n "Enter your SMTP Host URL: "
    read smtp_host

    echo -n "Enter your SMTP Host Port: "
    read smtp_port

    echo -n "Enter your SMTP username: "
    read smtp_user

    read -s -p "Enter your SMTP password: " smtp_password; echo "***"

    echo -n "Enable Authenticated SMTP? Enter 1 for yes and 0 for no(default is 1): "
    read smtp_authenticated

    echo -n "Enable Secure SMTP (use SSL)? Enter 1 for yes and 0 for no: "
    read smtp_secure_enabled

  else
    mail_from=""
    mail_from_name=""
    smtp_host=""
    smtp_port=""
    smtp_user=""
    smtp_password=""
    smtp_authenticated=1
    smtp_secure_enabled=0
  fi

  # Prompt for file upload setup
  echo ""
  echo "📁 Do you want to configure file uploads?"
  echo "   If you skip this, the following features will be disabled:"
  echo "   - Adding images to surveys (e.g., in questions or as background)"
  echo "   - 'File Upload' and 'Picture Selection' question types"
  echo "   - Project logos"
  echo "   - Custom organization logo in emails"
  read -p "Configure file uploads now? [Y/n] " configure_uploads
  configure_uploads=$(echo "$configure_uploads" | tr '[:upper:]' '[:lower:]')
  if [[ -z $configure_uploads ]]; then configure_uploads="y"; fi

  if [[ $configure_uploads == "y" ]]; then
    # Storage choice: External S3 vs bundled RustFS
    read -p "🗄️  Do you want to use an external S3-compatible storage (AWS S3/DO Spaces/etc.)? [y/N] " use_external_s3
    use_external_s3=$(echo "$use_external_s3" | tr '[:upper:]' '[:lower:]')
    if [[ -z $use_external_s3 ]]; then use_external_s3="n"; fi

    if [[ $use_external_s3 == "y" ]]; then
      echo "🔧 Enter S3 configuration (leave Endpoint empty for AWS S3):"
      read -p "   S3 Access Key: " ext_s3_access_key
      read -s -p "   S3 Secret Key: " ext_s3_secret_key; echo "***"
      read -p "   S3 Region (e.g., us-east-1): " ext_s3_region
      read -p "   S3 Bucket Name: " ext_s3_bucket
      read -p "   S3 Endpoint URL (leave empty if you are using AWS S3, otherwise please enter the endpoint URL of the third party S3 compatible storage service): " ext_s3_endpoint
      
      rustfs_storage="n"
    else
      rustfs_storage="y"
      default_files_domain="files.$domain_name"
      read -p "🔗 Enter the files subdomain for object storage (e.g., $default_files_domain): " files_domain
      if [[ -z $files_domain ]]; then files_domain="$default_files_domain"; fi

      echo "🔑 Generating RustFS credentials..."
      rustfs_admin_user="formbricks-$(openssl rand -hex 4)"
      rustfs_admin_password=$(openssl rand -base64 20)
      rustfs_service_user="formbricks-service-$(openssl rand -hex 4)"
      rustfs_service_password=$(openssl rand -base64 20)
      rustfs_bucket_name="formbricks-uploads"
      rustfs_policy_name="formbricks-policy"
      
      echo "✅ RustFS will be configured with:"
      echo "   S3 Access Key (least privilege): $rustfs_service_user"
      echo "   Bucket: $rustfs_bucket_name"
    fi
  else
    rustfs_storage="n"
    use_external_s3="n"
    echo "⚠️ File uploads are disabled. Proceeding without S3-compatible storage configuration."
  fi

  echo "📥 Downloading docker-compose.yml from Formbricks GitHub repository..."
  curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/formbricks/formbricks/stable/docker/docker-compose.yml

  echo "🚙 Updating docker-compose.yml with your custom inputs..."
  sed -i "/WEBAPP_URL:/s|WEBAPP_URL:.*|WEBAPP_URL: \"https://$domain_name\"|" docker-compose.yml
  sed -i "/NEXTAUTH_URL:/s|NEXTAUTH_URL:.*|NEXTAUTH_URL: \"https://$domain_name\"|" docker-compose.yml

  nextauth_secret=$(openssl rand -hex 32) && sed -i "/NEXTAUTH_SECRET:$/s/NEXTAUTH_SECRET:.*/NEXTAUTH_SECRET: $nextauth_secret/" docker-compose.yml
  echo "🚗 NEXTAUTH_SECRET updated successfully!"

  encryption_key=$(openssl rand -hex 32) && sed -i "/ENCRYPTION_KEY:$/s/ENCRYPTION_KEY:.*/ENCRYPTION_KEY: $encryption_key/" docker-compose.yml
  echo "🚗 ENCRYPTION_KEY updated successfully!"

  cron_secret=$(openssl rand -hex 32) && sed -i "/CRON_SECRET:$/s/CRON_SECRET:.*/CRON_SECRET: $cron_secret/" docker-compose.yml	
  echo "🚗 CRON_SECRET updated successfully!"
  
  if [[ -n $mail_from ]]; then
    sed -i "s|# MAIL_FROM:|MAIL_FROM: \"$mail_from\"|" docker-compose.yml
    sed -i "s|# MAIL_FROM_NAME:|MAIL_FROM_NAME: \"$mail_from_name\"|" docker-compose.yml
    sed -i "s|# SMTP_HOST:|SMTP_HOST: \"$smtp_host\"|" docker-compose.yml
    sed -i "s|# SMTP_PORT:|SMTP_PORT: \"$smtp_port\"|" docker-compose.yml
    sed -i "s|# SMTP_SECURE_ENABLED:|SMTP_SECURE_ENABLED: $smtp_secure_enabled|" docker-compose.yml
    sed -i "s|# SMTP_USER:|SMTP_USER: \"$smtp_user\"|" docker-compose.yml
    sed -i "s|# SMTP_PASSWORD:|SMTP_PASSWORD: \"$smtp_password\"|" docker-compose.yml
    sed -i "s|# SMTP_AUTHENTICATED:|SMTP_AUTHENTICATED: $smtp_authenticated|" docker-compose.yml
  fi

  if [[ $use_external_s3 == "y" ]]; then
    echo "🚗 Configuring external S3..."
    sed -i "s|# S3_ACCESS_KEY:|S3_ACCESS_KEY: \"$ext_s3_access_key\"|" docker-compose.yml
    sed -i "s|# S3_SECRET_KEY:|S3_SECRET_KEY: \"$ext_s3_secret_key\"|" docker-compose.yml
    sed -i "s|# S3_REGION:|S3_REGION: \"$ext_s3_region\"|" docker-compose.yml
    sed -i "s|# S3_BUCKET_NAME:|S3_BUCKET_NAME: \"$ext_s3_bucket\"|" docker-compose.yml
    if [[ -n $ext_s3_endpoint ]]; then
      sed -i "s|# S3_ENDPOINT_URL:|S3_ENDPOINT_URL: \"$ext_s3_endpoint\"|" docker-compose.yml
      # Ensure S3_FORCE_PATH_STYLE is enabled for S3-compatible endpoints
      sed -E -i 's|^([[:space:]]*)#?[[:space:]]*S3_FORCE_PATH_STYLE:[[:space:]]*.*$|\1S3_FORCE_PATH_STYLE: 1|' docker-compose.yml
    else
      # Comment out S3_FORCE_PATH_STYLE for native AWS S3
      sed -E -i 's|^([[:space:]]*)#?[[:space:]]*S3_FORCE_PATH_STYLE:[[:space:]]*.*$|\1# S3_FORCE_PATH_STYLE:|' docker-compose.yml
    fi
    echo "🚗 External S3 configuration updated successfully!"
  elif [[ $rustfs_storage == "y" ]]; then
    echo "🚗 Configuring bundled RustFS..."
    write_rustfs_env_file ".env"
    sed -i 's|# S3_ACCESS_KEY:|S3_ACCESS_KEY: "${FORMBRICKS_RUSTFS_SERVICE_USER}"|' docker-compose.yml
    sed -i 's|# S3_SECRET_KEY:|S3_SECRET_KEY: "${FORMBRICKS_RUSTFS_SERVICE_PASSWORD}"|' docker-compose.yml
    sed -i 's|# S3_REGION:|S3_REGION: "${FORMBRICKS_RUSTFS_REGION}"|' docker-compose.yml
    sed -i 's|# S3_BUCKET_NAME:|S3_BUCKET_NAME: "${FORMBRICKS_RUSTFS_BUCKET_NAME}"|' docker-compose.yml
    if [[ $https_setup == "y" ]]; then
      sed -i "s|# S3_ENDPOINT_URL:|S3_ENDPOINT_URL: \"https://$files_domain\"|" docker-compose.yml
    else
      sed -i "s|# S3_ENDPOINT_URL:|S3_ENDPOINT_URL: \"http://$files_domain\"|" docker-compose.yml
    fi
    # Ensure S3_FORCE_PATH_STYLE is enabled for RustFS
    sed -E -i 's|^([[:space:]]*)#?[[:space:]]*S3_FORCE_PATH_STYLE:[[:space:]]*.*$|\1S3_FORCE_PATH_STYLE: 1|' docker-compose.yml
    echo "🚗 RustFS S3 configuration updated successfully!"
  fi

  # SUPER SIMPLE: Use multiple simple operations instead of complex AWK

  # Step 1: Add Traefik labels to formbricks service
  awk -v domain_name="$domain_name" -v hsts_enabled="$hsts_enabled" '
/formbricks:/,/^ *$/ {
    if ($0 ~ /<<: \*environment$/) {
        print "    labels:"
        print "      - \"traefik.enable=true\""
        print "      - \"traefik.http.routers.formbricks.rule=Host(`" domain_name "`)\""
        print "      - \"traefik.http.routers.formbricks.entrypoints=websecure\""
        print "      - \"traefik.http.routers.formbricks.tls=true\""
        print "      - \"traefik.http.routers.formbricks.tls.certresolver=default\""
        print "      - \"traefik.http.services.formbricks.loadbalancer.server.port=3000\""
        if (hsts_enabled == "y") {
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000\""
            print "      - \"traefik.http.middlewares.hstsHeader.headers.forceSTSHeader=true\""
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsPreload=true\""
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsIncludeSubdomains=true\""
        } else {
            print "      - \"traefik.http.routers.formbricks_http.entrypoints=web\""
            print "      - \"traefik.http.routers.formbricks_http.rule=Host(`" domain_name "`)\""
        }
        print $0
    } else {
        print $0
    }
    next
}
{ print }
' docker-compose.yml >tmp.yml && mv tmp.yml docker-compose.yml

  # Step 2: Ensure formbricks waits for rustfs-init to complete successfully (mapping depends_on)
  if [[ $rustfs_storage == "y" ]]; then
    # Remove any existing simple depends_on list and replace with mapping
    awk '
      BEGIN{in_fb=0; removing=0}
      /^  formbricks:/ {in_fb=1}
      in_fb && /^    depends_on:/ {removing=1; next}
      in_fb && removing && /^    [A-Za-z0-9_-]+:/ {removing=0}
      /^  [A-Za-z0-9_-]+:/ && !/^  formbricks:/ {in_fb=0}
      { if(!removing) print }
    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

    awk '
      BEGIN{in_fb=0; inserted=0}
      /^  formbricks:/ {in_fb=1}
      /^  [A-Za-z0-9_-]+:/ && !/^  formbricks:/ {in_fb=0}
      {
        print
        if (in_fb && !inserted && $0 ~ /^    image:/) {
          print "    depends_on:"
          print "      postgres:"
          print "        condition: service_started"
          print "      redis:"
          print "        condition: service_started"
          print "      rustfs-init:"
          print "        condition: service_completed_successfully"
          inserted=1
        }
      }
    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
  fi

  # Step 3: Build service snippets and inject them BEFORE the volumes section (non-destructive: skip if service exists)
  services_snippet_file="services_snippet.yml"
  : > "$services_snippet_file"

  insert_traefik="y"
  if grep -q "^  traefik:" docker-compose.yml; then insert_traefik="n"; fi

  if [[ $rustfs_storage == "y" ]]; then
    rustfs_cors_origin="https://$domain_name"
    if [[ $https_setup != "y" ]]; then
      rustfs_cors_origin="http://$domain_name"
    fi

    insert_rustfs_perms="y"; insert_rustfs="y"; insert_rustfs_init="y"
    if grep -q "^  rustfs-perms:" docker-compose.yml; then insert_rustfs_perms="n"; fi
    if grep -q "^  rustfs:" docker-compose.yml; then insert_rustfs="n"; fi
    if grep -q "^  rustfs-init:" docker-compose.yml; then insert_rustfs_init="n"; fi

    if [[ $insert_rustfs_perms == "y" ]]; then
      cat >> "$services_snippet_file" << EOF

  rustfs-perms:
    image: busybox:1.36.1
    user: "0:0"
    command: ["sh", "-c", "mkdir -p /data && chown -R 10001:10001 /data"]
    volumes:
      - rustfs-data:/data
EOF
    fi

    if [[ $insert_rustfs == "y" ]]; then
      cat >> "$services_snippet_file" << EOF
  rustfs:
    restart: always
    image: rustfs/rustfs:1.0.0-alpha.93
    depends_on:
      rustfs-perms:
        condition: service_completed_successfully
    command: /data
    environment:
      RUSTFS_ACCESS_KEY: "\${FORMBRICKS_RUSTFS_ADMIN_USER}"
      RUSTFS_SECRET_KEY: "\${FORMBRICKS_RUSTFS_ADMIN_PASSWORD}"
      RUSTFS_ADDRESS: ":9000"
    volumes:
      - rustfs-data:/data
    labels:
      - "traefik.enable=true"
      # S3 API on files subdomain
      - "traefik.http.routers.rustfs-s3.rule=Host(\`$files_domain\`)"
      - "traefik.http.routers.rustfs-s3.entrypoints=websecure"
      - "traefik.http.routers.rustfs-s3.tls=true"
      - "traefik.http.routers.rustfs-s3.tls.certresolver=default"
      - "traefik.http.routers.rustfs-s3.service=rustfs-s3"
      - "traefik.http.services.rustfs-s3.loadbalancer.server.port=9000"
      # CORS and rate limit (adjust origins if needed)
      - "traefik.http.routers.rustfs-s3.middlewares=rustfs-cors,rustfs-ratelimit"
      - "traefik.http.middlewares.rustfs-cors.headers.accesscontrolallowmethods=GET,PUT,POST,DELETE,HEAD,OPTIONS"
      - "traefik.http.middlewares.rustfs-cors.headers.accesscontrolallowheaders=*"
      - "traefik.http.middlewares.rustfs-cors.headers.accesscontrolalloworiginlist=https://$domain_name"
      - "traefik.http.middlewares.rustfs-cors.headers.accesscontrolmaxage=100"
      - "traefik.http.middlewares.rustfs-cors.headers.addvaryheader=true"
      - "traefik.http.middlewares.rustfs-ratelimit.ratelimit.average=100"
      - "traefik.http.middlewares.rustfs-ratelimit.ratelimit.burst=200"
EOF
    fi

    if [[ $insert_rustfs_init == "y" ]]; then
      cat >> "$services_snippet_file" << EOF
  rustfs-init:
    image: minio/mc@sha256:95b5f3f7969a5c5a9f3a700ba72d5c84172819e13385aaf916e237cf111ab868
    depends_on:
      - rustfs
    environment:
      RUSTFS_ADMIN_USER: "\${FORMBRICKS_RUSTFS_ADMIN_USER}"
      RUSTFS_ADMIN_PASSWORD: "\${FORMBRICKS_RUSTFS_ADMIN_PASSWORD}"
      RUSTFS_SERVICE_USER: "\${FORMBRICKS_RUSTFS_SERVICE_USER}"
      RUSTFS_SERVICE_PASSWORD: "\${FORMBRICKS_RUSTFS_SERVICE_PASSWORD}"
      RUSTFS_BUCKET_NAME: "\${FORMBRICKS_RUSTFS_BUCKET_NAME}"
      RUSTFS_POLICY_NAME: "\${FORMBRICKS_RUSTFS_POLICY_NAME}"
      RUSTFS_CORS_ALLOWED_ORIGINS: "$rustfs_cors_origin"
    entrypoint: ["/bin/sh", "/tmp/rustfs-init.sh"]
    volumes:
      - ./rustfs-init.sh:/tmp/rustfs-init.sh:ro
EOF
    fi

    if [[ $insert_traefik == "y" ]]; then
      cat >> "$services_snippet_file" << EOF
  traefik:
    image: "traefik:v2.11.31"
    restart: always
    container_name: "traefik"
    depends_on:
      - formbricks
      - rustfs
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./traefik.yaml:/traefik.yaml
      - ./traefik-dynamic.yaml:/traefik-dynamic.yaml
      - ./acme.json:/acme.json
      - /var/run/docker.sock:/var/run/docker.sock:ro
EOF
    fi

    # Downgrade RustFS router to plain HTTP when HTTPS is not configured
    if [[ $https_setup != "y" ]]; then
      sed -i 's/traefik.http.routers.rustfs-s3.entrypoints=websecure/traefik.http.routers.rustfs-s3.entrypoints=web/' "$services_snippet_file"
      sed -i '/traefik.http.routers.rustfs-s3.tls=true/d' "$services_snippet_file"
      sed -i '/traefik.http.routers.rustfs-s3.tls.certresolver=default/d' "$services_snippet_file"
      sed -i "s|accesscontrolalloworiginlist=https://$domain_name|accesscontrolalloworiginlist=http://$domain_name|" "$services_snippet_file"
    fi
  else
    if [[ $insert_traefik == "y" ]]; then
      cat > "$services_snippet_file" << EOF

  traefik:
    image: "traefik:v2.11.31"
    restart: always
    container_name: "traefik"
    depends_on:
      - formbricks
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./traefik.yaml:/traefik.yaml
      - ./traefik-dynamic.yaml:/traefik-dynamic.yaml
      - ./acme.json:/acme.json
      - /var/run/docker.sock:/var/run/docker.sock:ro
EOF
    else
      : > "$services_snippet_file"
    fi
  fi

  awk '
  {
    print
    if ($0 ~ /^services:$/ && !inserted) {
      while ((getline line < "services_snippet.yml") > 0) print line
      close("services_snippet.yml")
      inserted = 1
    }
  }
  ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

  rm -f "$services_snippet_file"

  # Ensure required volumes exist without removing user-defined volumes
  if grep -q '^volumes:' docker-compose.yml; then
    # Ensure postgres
    if ! awk '/^volumes:/{invol=1; next} invol && (/^[^[:space:]]/ || NF==0){invol=0} invol{ if($1=="postgres:") found=1 } END{ exit(found?0:1) }' docker-compose.yml; then
      awk '
        /^volumes:/ { print; invol=1; next }
        invol && /^[^[:space:]]/ { if(!added){ print "  postgres:"; print "    driver: local"; added=1 } ; invol=0 }
        { print }
        END { if (invol && !added) { print "  postgres:"; print "    driver: local" } }
      ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
    fi
    # Ensure redis
    if ! awk '/^volumes:/{invol=1; next} invol && (/^[^[:space:]]/ || NF==0){invol=0} invol{ if($1=="redis:") found=1 } END{ exit(found?0:1) }' docker-compose.yml; then
      awk '
        /^volumes:/ { print; invol=1; next }
        invol && /^[^[:space:]]/ { if(!added){ print "  redis:"; print "    driver: local"; added=1 } ; invol=0 }
        { print }
        END { if (invol && !added) { print "  redis:"; print "    driver: local" } }
      ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
    fi
    # Ensure rustfs-data if needed
    if [[ $rustfs_storage == "y" ]]; then
      if ! awk '/^volumes:/{invol=1; next} invol && (/^[^[:space:]]/ || NF==0){invol=0} invol{ if($1=="rustfs-data:") found=1 } END{ exit(found?0:1) }' docker-compose.yml; then
        awk '
          /^volumes:/ { print; invol=1; next }
          invol && /^[^[:space:]]/ { if(!added){ print "  rustfs-data:"; print "    driver: local"; added=1 } ; invol=0 }
          { print }
          END { if (invol && !added) { print "  rustfs-data:"; print "    driver: local" } }
        ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
      fi
    fi
  else
    {
      echo ""
      echo "volumes:"
      echo "  postgres:"
      echo "    driver: local"
      echo "  redis:"
      echo "    driver: local"
      if [[ $rustfs_storage == "y" ]]; then
        echo "  rustfs-data:"
        echo "    driver: local"
      fi
    } >> docker-compose.yml
  fi

  # Create rustfs-init script outside heredoc to avoid variable expansion issues
  if [[ $rustfs_storage == "y" ]]; then
    write_rustfs_init_script "rustfs-init.sh"
  fi

  newgrp docker <<END

docker compose up -d

echo "🔗 To edit more variables and deeper config, go to the formbricks/docker-compose.yml, edit the file, and restart the container!"

echo "🚨 Make sure you have set up the DNS records as well as inbound rules for the domain name and IP address of this instance."
echo ""

if [[ $rustfs_storage == "y" ]]; then
    echo "🗄️  RustFS Storage Setup Complete:"
    echo "   • Bucket: $rustfs_bucket_name (✅ created and secured)"
    echo "   • Generated credentials stored in ./formbricks/.env (permissions set to 600)"
    echo ""
fi

echo "🎉 All done! Please setup your Formbricks instance by visiting your domain at https://$domain_name. You can check the status of Formbricks & Traefik with 'cd formbricks && sudo docker compose ps.'"

END

}

uninstall_formbricks() {
  echo "🗑️ Preparing to Uninstalling Formbricks..."
  read -p "Are you sure you want to uninstall Formbricks? This will delete all the data associated with it! (yes/no): " uninstall_confirmation
  uninstall_confirmation=$(echo "$uninstall_confirmation" | tr '[:upper:]' '[:lower:]')
  if [[ $uninstall_confirmation == "yes" ]]; then
    cd formbricks
    sudo docker compose down
    cd ..
    sudo rm -rf formbricks
    echo "🛑 Formbricks uninstalled successfully!"
  else
    echo "❌ Uninstalling Formbricks has been cancelled."
  fi
}

stop_formbricks() {
  echo "🛑 Stopping Formbricks..."
  cd formbricks
  sudo docker compose down
  echo "🎉 Formbricks instance stopped successfully!"
}

update_formbricks() {
  echo "🔄 Updating Formbricks..."
  cd formbricks
  sudo docker compose pull
  sudo docker compose down
  sudo docker compose up -d
  echo "🎉 Formbricks updated successfully!"
  echo "🎉 Check the status of Formbricks & Traefik with 'cd formbricks && sudo docker compose logs.'"
}

restart_formbricks() {
  echo "🔄 Restarting Formbricks..."
  cd formbricks
  sudo docker compose restart
  echo "🎉 Formbricks restarted successfully!"
}

get_logs() {
  echo "📃 Getting Formbricks logs..."
  cd formbricks
  sudo docker compose logs
}

cleanup_rustfs_init() {
  echo "🧹 Cleaning up RustFS init service and references..."
  cd formbricks

  # Remove rustfs-init service block from docker-compose.yml
  awk '
    BEGIN{skip=0}
    /^services:[[:space:]]*$/ { print; next }
    /^  rustfs-init:/         { skip=1; next }
    /^  [A-Za-z0-9_-]+:/      { if (skip) skip=0 }
    { if (!skip) print }
  ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

  # Remove list-style init dependencies under depends_on (if any)
  if sed --version >/dev/null 2>&1; then
    sed -E -i '/^[[:space:]]*-[[:space:]]*rustfs-init[[:space:]]*$/d' docker-compose.yml
    sed -E -i '/^[[:space:]]*-[[:space:]]*minio-init[[:space:]]*$/d' docker-compose.yml
  else
    sed -E -i '' '/^[[:space:]]*-[[:space:]]*rustfs-init[[:space:]]*$/d' docker-compose.yml
    sed -E -i '' '/^[[:space:]]*-[[:space:]]*minio-init[[:space:]]*$/d' docker-compose.yml
  fi

  # Remove the mapping style depends_on entries for init jobs
  if sed --version >/dev/null 2>&1; then
    sed -i '/^[[:space:]]*rustfs-init:[[:space:]]*$/,/^[[:space:]]*condition:[[:space:]]*service_completed_successfully[[:space:]]*$/d' docker-compose.yml
    sed -i '/^[[:space:]]*minio-init:[[:space:]]*$/,/^[[:space:]]*condition:[[:space:]]*service_completed_successfully[[:space:]]*$/d' docker-compose.yml
  else
    sed -i '' '/^[[:space:]]*rustfs-init:[[:space:]]*$/,/^[[:space:]]*condition:[[:space:]]*service_completed_successfully[[:space:]]*$/d' docker-compose.yml
    sed -i '' '/^[[:space:]]*minio-init:[[:space:]]*$/,/^[[:space:]]*condition:[[:space:]]*service_completed_successfully[[:space:]]*$/d' docker-compose.yml
  fi

  # Remove any stopped init containers and restart without orphans
  docker compose rm -f -s rustfs-init >/dev/null 2>&1 || true
  docker compose rm -f -s minio-init >/dev/null 2>&1 || true
  docker compose up -d --remove-orphans

  echo "✅ RustFS init cleanup complete."
}

cleanup_minio_init() {
  cleanup_rustfs_init
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  case "$1" in
  install)
    install_formbricks
    ;;
  update)
    update_formbricks
    ;;
  stop)
    stop_formbricks
    ;;
  restart)
    restart_formbricks
    ;;
  logs)
    get_logs
    ;;
  cleanup-rustfs-init)
    cleanup_rustfs_init
    ;;
  cleanup-minio-init)
    cleanup_minio_init
    ;;
  uninstall)
    uninstall_formbricks
    ;;
  *)
    echo "🚀 Executing default step of installing Formbricks"
    install_formbricks
    ;;
  esac
fi
