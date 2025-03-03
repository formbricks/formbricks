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

  # Ask the user for their domain name
  echo "🔗 Please enter your domain name for the SSL certificate (🚨 do NOT enter the protocol (http/https/etc)):"
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
        # TLS 1.2 Ciphers
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
        - TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA
        - TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA
        - TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
        - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256

        # TLS 1.3 Ciphers (These are automatically used for TLS 1.3 connections)
        - TLS_AES_128_GCM_SHA256
        - TLS_AES_256_GCM_SHA384
        - TLS_CHACHA20_POLY1305_SHA256

        # Fallback
        - TLS_FALLBACK_SCSV
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

    echo -n "Enter your SMTP Host URL: "
    read smtp_host

    echo -n "Enter your SMTP Host Port: "
    read smtp_port

    echo -n "Enter your SMTP username: "
    read smtp_user

    echo -n "Enter your SMTP password: "
    read smtp_password
    
    echo -n "Enable Authenticated SMTP? Enter 1 for yes and 0 for no(default is 1): "
    read smtp_authenticated

    echo -n "Enable Secure SMTP (use SSL)? Enter 1 for yes and 0 for no: "
    read smtp_secure_enabled

  else
    mail_from=""
    smtp_host=""
    smtp_port=""
    smtp_user=""
    smtp_password=""
    smtp_authenticated=1
    smtp_secure_enabled=0
  fi

  echo "📥 Downloading docker-compose.yml from Formbricks GitHub repository..."
  curl -o docker-compose.yml https://raw.githubusercontent.com/formbricks/formbricks/main/docker/docker-compose.yml

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
    sed -i "s|# SMTP_HOST:|SMTP_HOST: \"$smtp_host\"|" docker-compose.yml
    sed -i "s|# SMTP_PORT:|SMTP_PORT: \"$smtp_port\"|" docker-compose.yml
    sed -i "s|# SMTP_SECURE_ENABLED:|SMTP_SECURE_ENABLED: $smtp_secure_enabled|" docker-compose.yml
    sed -i "s|# SMTP_USER:|SMTP_USER: \"$smtp_user\"|" docker-compose.yml
    sed -i "s|# SMTP_PASSWORD:|SMTP_PASSWORD: \"$smtp_password\"|" docker-compose.yml
    sed -i "s|# SMTP_AUTHENTICATED:|SMTP_AUTHENTICATED: $smtp_authenticated|" docker-compose.yml
  fi

  awk -v domain_name="$domain_name" -v hsts_enabled="$hsts_enabled" '
/formbricks:/,/^ *$/ {
    if ($0 ~ /depends_on:/) {
        inserting_labels=1
    }
    if (inserting_labels && ($0 ~ /ports:/)) {
        print "    labels:"
        print "      - \"traefik.enable=true\"  # Enable Traefik for this service"
        print "      - \"traefik.http.routers.formbricks.rule=Host(`" domain_name "`)\"  # Use your actual domain or IP"
        print "      - \"traefik.http.routers.formbricks.entrypoints=websecure\"  # Use the websecure entrypoint (port 443 with TLS)"
        print "      - \"traefik.http.routers.formbricks.tls=true\"  # Enable TLS"
        print "      - \"traefik.http.routers.formbricks.tls.certresolver=default\"  # Specify the certResolver"
        print "      - \"traefik.http.services.formbricks.loadbalancer.server.port=3000\"  # Forward traffic to Formbricks on port 3000"
        if (hsts_enabled == "y") {
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000\"  # Set HSTS (HTTP Strict Transport Security) max-age to 1 year (31536000 seconds)"
            print "      - \"traefik.http.middlewares.hstsHeader.headers.forceSTSHeader=true\"  # Ensure the HSTS header is always included in responses"
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsPreload=true\"  # Allow the domain to be preloaded in browser HSTS preload list"
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsIncludeSubdomains=true\"  # Apply HSTS policy to all subdomains as well"
        } else {
            print "      - \"traefik.http.routers.formbricks_http.entrypoints=web\"  # Use the web entrypoint (port 80)"
            print "      - \"traefik.http.routers.formbricks_http.rule=Host(`" domain_name "`)\"  # Use your actual domain or IP"
        }
        inserting_labels=0
    }
    print
    next
}
/^volumes:/ {
    print "  traefik:"
    print "    image: \"traefik:v2.7\""
    print "    restart: always"
    print "    container_name: \"traefik\""
    print "    depends_on:"
    print "      - formbricks"
    print "    ports:"
    print "      - \"80:80\""
    print "      - \"443:443\""
    print "      - \"8080:8080\""
    print "    volumes:"
    print "      - ./traefik.yaml:/traefik.yaml"
    print "      - ./traefik-dynamic.yaml:/traefik-dynamic.yaml"
    print "      - ./acme.json:/acme.json"
    print "      - /var/run/docker.sock:/var/run/docker.sock:ro"
    print ""
}
1
' docker-compose.yml >tmp.yml && mv tmp.yml docker-compose.yml

  newgrp docker <<END

docker compose up -d

echo "🔗 To edit more variables and deeper config, go to the formbricks/docker-compose.yml, edit the file, and restart the container!"

echo "🚨 Make sure you have set up the DNS records as well as inbound rules for the domain name and IP address of this instance."
echo ""
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
