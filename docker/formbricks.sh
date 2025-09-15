#!/bin/env bash

set -e
ubuntu_version=$(lsb_release -a 2>/dev/null | grep -v "No LSB modules are available." | grep "Description:" | awk -F "Description:\t" '{print $2}')

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
      caServer: "https://acme-v01.api.letsencrypt.org/directory"
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
  websecure:
    address: ":443"
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
    # Storage choice: External S3 vs bundled MinIO
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
      
      minio_storage="n"
    else
      minio_storage="y"
      default_files_domain="files.$domain_name"
      read -p "🔗 Enter the files subdomain for object storage (e.g., $default_files_domain): " files_domain
      if [[ -z $files_domain ]]; then files_domain="$default_files_domain"; fi

      echo "🔑 Generating MinIO credentials..."
      minio_root_user="formbricks-$(openssl rand -hex 4)"
      minio_root_password=$(openssl rand -base64 20)
      minio_service_user="formbricks-service-$(openssl rand -hex 4)"
      minio_service_password=$(openssl rand -base64 20)
      minio_bucket_name="formbricks-uploads"
      minio_policy_name="formbricks-policy-$(openssl rand -hex 4)"
      
      echo "✅ MinIO will be configured with:"
      echo "   S3 Access Key (least privilege): $minio_service_user"
      echo "   Bucket: $minio_bucket_name"
    fi
  else
    minio_storage="n"
    use_external_s3="n"
    echo "⚠️ File uploads are disabled. Proceeding without S3/MinIO configuration."
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
      # Ensure S3_FORCE_PATH_STYLE is enabled for S3-compatible endpoints (match commented or uncommented)
      sed -i 's|#\? *S3_FORCE_PATH_STYLE:.*|S3_FORCE_PATH_STYLE: 1|' docker-compose.yml
    else
      # Comment out S3_FORCE_PATH_STYLE for native AWS S3 (match commented or uncommented)
      sed -i 's|#\? *S3_FORCE_PATH_STYLE:.*|# S3_FORCE_PATH_STYLE:|' docker-compose.yml
    fi
    echo "🚗 External S3 configuration updated successfully!"
  elif [[ $minio_storage == "y" ]]; then
    echo "🚗 Configuring bundled MinIO..."
    sed -i "s|# S3_ACCESS_KEY:|S3_ACCESS_KEY: \"$minio_service_user\"|" docker-compose.yml
    sed -i "s|# S3_SECRET_KEY:|S3_SECRET_KEY: \"$minio_service_password\"|" docker-compose.yml
    sed -i "s|# S3_REGION:|S3_REGION: \"us-east-1\"|" docker-compose.yml
    sed -i "s|# S3_BUCKET_NAME:|S3_BUCKET_NAME: \"$minio_bucket_name\"|" docker-compose.yml
    if [[ $https_setup == "y" ]]; then
      sed -i "s|# S3_ENDPOINT_URL:|S3_ENDPOINT_URL: \"https://$files_domain\"|" docker-compose.yml
    else
      sed -i "s|# S3_ENDPOINT_URL:|S3_ENDPOINT_URL: \"http://$files_domain\"|" docker-compose.yml
    fi
    # Ensure S3_FORCE_PATH_STYLE is enabled for MinIO (match commented or uncommented)
    sed -i 's|#\? *S3_FORCE_PATH_STYLE:.*|S3_FORCE_PATH_STYLE: 1|' docker-compose.yml
    echo "🚗 MinIO S3 configuration updated successfully!"
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

  # Step 2: Add minio-init dependency to formbricks if MinIO enabled
  if [[ $minio_storage == "y" ]]; then
    sed -i '/formbricks:/,/depends_on:/{
      /- postgres/a\      - minio-init
    }' docker-compose.yml
  fi

  # Step 3: Build service snippets and inject them BEFORE the volumes section (robust, no sed -i multiline)
  services_snippet_file="services_snippet.yml"
  : > "$services_snippet_file"

  if [[ $minio_storage == "y" ]]; then
    cat > "$services_snippet_file" << EOF

  minio:
    restart: always
    image: minio/minio@sha256:13582eff79c6605a2d315bdd0e70164142ea7e98fc8411e9e10d089502a6d883
    command: server /data
    environment:
      MINIO_ROOT_USER: "$minio_root_user"
      MINIO_ROOT_PASSWORD: "$minio_root_password"
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    labels:
      - "traefik.enable=true"
      # S3 API on files subdomain
      - "traefik.http.routers.minio-s3.rule=Host(\`$files_domain\`)"
      - "traefik.http.routers.minio-s3.entrypoints=websecure"
      - "traefik.http.routers.minio-s3.tls=true"
      - "traefik.http.routers.minio-s3.tls.certresolver=default"
      - "traefik.http.routers.minio-s3.service=minio-s3"
      - "traefik.http.services.minio-s3.loadbalancer.server.port=9000"
      # CORS and rate limit (adjust origins if needed)
      - "traefik.http.routers.minio-s3.middlewares=minio-cors,minio-ratelimit"
      - "traefik.http.middlewares.minio-cors.headers.accesscontrolallowmethods=GET,PUT,POST,DELETE,HEAD,OPTIONS"
      - "traefik.http.middlewares.minio-cors.headers.accesscontrolallowheaders=*"
      - "traefik.http.middlewares.minio-cors.headers.accesscontrolalloworiginlist=https://$domain_name"
      - "traefik.http.middlewares.minio-cors.headers.accesscontrolmaxage=100"
      - "traefik.http.middlewares.minio-cors.headers.addvaryheader=true"
      - "traefik.http.middlewares.minio-ratelimit.ratelimit.average=100"
      - "traefik.http.middlewares.minio-ratelimit.ratelimit.burst=200"
  minio-init:
    image: minio/mc@sha256:95b5f3f7969a5c5a9f3a700ba72d5c84172819e13385aaf916e237cf111ab868
    depends_on:
      minio:
        condition: service_healthy
    environment:
      MINIO_ROOT_USER: "$minio_root_user"
      MINIO_ROOT_PASSWORD: "$minio_root_password"
      MINIO_SERVICE_USER: "$minio_service_user"
      MINIO_SERVICE_PASSWORD: "$minio_service_password"
      MINIO_BUCKET_NAME: "$minio_bucket_name"
    entrypoint:
      - /bin/sh
      - -c
      - |
        echo '🔗 Setting up MinIO alias...';
        mc alias set minio http://minio:9000 "$minio_root_user" "$minio_root_password";
        
        echo '🪣 Creating bucket (idempotent)...';
        mc mb minio/$minio_bucket_name --ignore-existing;
        
        echo '📄 Creating JSON policy file...';
        printf '%s' "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:DeleteObject\",\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":[\"arn:aws:s3:::$minio_bucket_name/*\"]},{\"Effect\":\"Allow\",\"Action\":[\"s3:ListBucket\"],\"Resource\":[\"arn:aws:s3:::$minio_bucket_name\"]}]}" > /tmp/formbricks-policy.json
        
        echo '🔒 Creating policy (idempotent)...';
        if ! mc admin policy info minio $minio_policy_name >/dev/null 2>&1; then
          mc admin policy create minio $minio_policy_name /tmp/formbricks-policy.json || mc admin policy add minio $minio_policy_name /tmp/formbricks-policy.json;
          echo 'Policy created successfully.';
        else
          echo 'Policy already exists, skipping creation.';
        fi
        
        echo '👤 Creating service user (idempotent)...';
        if ! mc admin user info minio "$minio_service_user" >/dev/null 2>&1; then
          mc admin user add minio "$minio_service_user" "$minio_service_password";
          echo 'User created successfully.';
        else
          echo 'User already exists, skipping creation.';
        fi
        
        echo '🔗 Attaching policy to user (idempotent)...';
        mc admin policy attach minio $minio_policy_name --user "$minio_service_user" || echo 'Policy already attached or attachment failed (non-fatal).';
        
        echo '✅ MinIO setup complete!';
        exit 0;

  traefik:
    image: "traefik:v2.7"
    restart: always
    container_name: "traefik"
    depends_on:
      - formbricks
      - minio
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./traefik.yaml:/traefik.yaml
      - ./traefik-dynamic.yaml:/traefik-dynamic.yaml
      - ./acme.json:/acme.json
      - /var/run/docker.sock:/var/run/docker.sock:ro
EOF

    # Downgrade MinIO router to plain HTTP when HTTPS is not configured
    if [[ $https_setup != "y" ]]; then
      sed -i 's/traefik.http.routers.minio-s3.entrypoints=websecure/traefik.http.routers.minio-s3.entrypoints=web/' "$services_snippet_file"
      sed -i '/traefik.http.routers.minio-s3.tls=true/d' "$services_snippet_file"
      sed -i '/traefik.http.routers.minio-s3.tls.certresolver=default/d' "$services_snippet_file"
      sed -i "s|accesscontrolalloworiginlist=https://$domain_name|accesscontrolalloworiginlist=http://$domain_name|" "$services_snippet_file"
    fi
  else
    cat > "$services_snippet_file" << EOF

  traefik:
    image: "traefik:v2.7"
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

  # Deterministically rewrite the volumes section to include required volumes
  awk -v add_minio="$minio_storage" '
  BEGIN { in_vol=0 }
  /^volumes:/ {
    print "volumes:";
    print "  postgres:";
    print "    driver: local";
    print "  uploads:";
    print "    driver: local";
    if (add_minio == "y") {
      print "  minio-data:";
      print "    driver: local";
    }
    in_vol=1; skip=1; next
  }
  # Skip original volumes block lines until EOF (we already printed ours)
  { if (!skip) print }
  ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

  newgrp docker <<END

docker compose up -d


echo "🔗 To edit more variables and deeper config, go to the formbricks/docker-compose.yml, edit the file, and restart the container!"

echo "🚨 Make sure you have set up the DNS records as well as inbound rules for the domain name and IP address of this instance."
echo ""

if [[ $minio_storage == "y" ]]; then
    echo "🗄️  MinIO Storage Setup Complete:"
    echo "   • Access Key: $minio_service_user (least privilege)"
    echo "   • Bucket: $minio_bucket_name (✅ created and secured)"
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
uninstall)
  uninstall_formbricks
  ;;
*)
  echo "🚀 Executing default step of installing Formbricks"
  install_formbricks
  ;;
esac