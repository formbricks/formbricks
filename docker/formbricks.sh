#!/bin/env bash

set -e
ubuntu_version=$(lsb_release -a 2>/dev/null | grep -v "No LSB modules are available." | grep "Description:" | awk -F "Description:\t" '{print $2}')
legacy_valkey_image="valkey/valkey@sha256:12ba4f45a7c3e1d0f076acd616cb230834e75a77e8516dde382720af32832d6d"
multi_arch_valkey_image="valkey/valkey@sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84"
# v3.6.15 or later: before it, the buffering middleware on the auth routers turned an empty chunked response,
# such as the redirect every OAuth/SSO callback answers with, into a 500 (traefik#11568, ENG-3977).
# docker/traefik-auth-smoke.sh runs this image with the installer's static config and labels.
traefik_image="traefik:v3.6.25"
stable_docker_files_url="https://raw.githubusercontent.com/formbricks/formbricks/stable/docker"
# Cube reads its model from these files, bind-mounted out of the installation directory.
bundled_cube_files=("cube/cube.js" "cube/schema/FeedbackRecords.js")

write_rustfs_init_script() {
  local target_path="${1:-rustfs-init.sh}"
  local script_dir
  local template_path

  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  template_path="${script_dir}/rustfs-init.sh"

  if [ -f "$template_path" ]; then
    cp "$template_path" "$target_path"
    chmod 755 "$target_path"
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
until rc alias set rustfs "$rustfs_endpoint_url" "$RUSTFS_ADMIN_USER" "$RUSTFS_ADMIN_PASSWORD" >/dev/null 2>&1 \
  && rc bucket list rustfs >/dev/null 2>&1; do
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
rc bucket create "rustfs/$RUSTFS_BUCKET_NAME" --ignore-existing

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

  rc bucket cors set "rustfs/$RUSTFS_BUCKET_NAME" "$cors_file"
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
if ! rc admin policy info rustfs "$RUSTFS_POLICY_NAME" >/dev/null 2>&1; then
  rc admin policy create rustfs "$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json
  echo 'Policy created successfully.'
else
  echo 'Policy already exists, skipping creation.'
fi

echo '👤 Creating service user (idempotent)...'
if ! rc admin user info rustfs "$RUSTFS_SERVICE_USER" >/dev/null 2>&1; then
  rc admin user add rustfs "$RUSTFS_SERVICE_USER" "$RUSTFS_SERVICE_PASSWORD"
  echo 'User created successfully.'
else
  echo 'User already exists, skipping creation.'
fi

echo '🔗 Attaching policy to user (idempotent)...'
rc admin policy attach rustfs "$RUSTFS_POLICY_NAME" --user "$RUSTFS_SERVICE_USER"

echo '✅ RustFS setup complete!'
RUSTFS_SCRIPT_EOF

  chmod 755 "$target_path"
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

formbricks_docker_command=(docker)

configure_formbricks_docker_command() {
  if docker info >/dev/null 2>&1; then
    formbricks_docker_command=(docker)
    return
  fi

  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    formbricks_docker_command=(sudo docker)
    return
  fi

  return 1
}

run_formbricks_docker_compose() {
  "${formbricks_docker_command[@]}" compose "$@"
}

read_rendered_compose_password() {
  local compose_file="$1"
  local env_file="${2:-}"
  local encoded_password
  local rendered_config
  local rendered_password
  local without_escaped_dollars
  local compose_args=(-f "$compose_file")

  if [ -n "$env_file" ]; then
    compose_args=(--env-file "$env_file" "${compose_args[@]}")
  fi

  if ! command -v docker >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    return 1
  fi

  rendered_config=$(
    unset POSTGRES_PASSWORD POSTGRES_PASSWORD_URL_ENCODED
    run_formbricks_docker_compose "${compose_args[@]}" config --format json 2>/dev/null
  ) || return 1
  encoded_password=$(printf '%s' "$rendered_config" | jq -er '
      .services.postgres.environment.POSTGRES_PASSWORD
      | select(type == "string" and length > 0)
      | select((contains("\n") or contains("\r")) | not)
      | @base64
    ') || return 1

  rendered_password=$(printf '%s' "$encoded_password" | base64 --decode) || return 1
  # Compose doubles literal dollar signs in its rendered model so that the model can be parsed again.
  without_escaped_dollars=${rendered_password//\$\$/}
  if [[ "$without_escaped_dollars" == *\$* ]]; then
    return 1
  fi

  printf '%s' "${rendered_password//\$\$/\$}"
}

read_existing_postgres_password() {
  local env_file="${1:-.env}"
  local compose_file="${2:-docker-compose.yml}"
  local existing_password

  if [ -f "$env_file" ]; then
    if [ ! -f "$compose_file" ]; then
      echo "❌ Could not safely resolve the existing PostgreSQL password. Refusing to rewrite $env_file." >&2
      return 1
    fi

    if existing_password=$(read_rendered_compose_password "$compose_file" "$env_file"); then
      printf '%s' "$existing_password"
      return
    fi

    echo "❌ Could not safely resolve the existing PostgreSQL password. Refusing to rewrite $env_file." >&2
    return 1
  fi

  if [ -f "$compose_file" ]; then
    if existing_password=$(read_rendered_compose_password "$compose_file"); then
      printf '%s' "$existing_password"
      return
    fi

    echo "❌ Could not safely resolve the existing PostgreSQL password. Refusing to rewrite .env." >&2
    return 1
  fi

  return 0
}

url_encode() {
  local LC_ALL=C
  local value="$1"
  local encoded=""
  local char
  local byte
  local i

  for ((i = 0; i < ${#value}; i++)); do
    char=${value:i:1}
    case "$char" in
      [a-zA-Z0-9.~_-]) encoded+="$char" ;;
      *)
        printf -v byte '%d' "'$char"
        printf -v encoded '%s%%%02X' "$encoded" "$((byte & 255))"
        ;;
    esac
  done

  printf '%s' "$encoded"
}

serialize_dotenv_value() {
  local value="$1"

  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//\$/\$\$}

  printf '"%s"' "$value"
}

write_generated_env_file() (
  local env_file="${1:-.env}"
  local postgres_password="${2:-}"
  local hub_api_key="${3:-}"
  local cubejs_api_secret="${4:-}"
  local authzed_token="${5:-}"
  local authzed_database_password="${6:-}"
  local serialized_postgres_password
  local postgres_password_url_encoded
  local tmp_file

  append_if_missing() {
    local key="$1"
    local value="$2"

    if ! grep -Eq "^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=" "$tmp_file"; then
      printf '%s=%s\n' "$key" "$value" >>"$tmp_file"
    fi
  }

  umask 077
  if [ -z "$postgres_password" ]; then
    postgres_password=$(openssl rand -hex 32)
  fi
  if [ -z "$hub_api_key" ]; then
    hub_api_key=$(openssl rand -hex 32)
  fi
  if [ -z "$cubejs_api_secret" ]; then
    cubejs_api_secret=$(openssl rand -hex 32)
  fi
  if [ -z "$authzed_token" ]; then
    authzed_token=$(openssl rand -hex 32)
  fi
  if [ -z "$authzed_database_password" ]; then
    authzed_database_password=$(openssl rand -hex 32)
  fi
  serialized_postgres_password=$(serialize_dotenv_value "$postgres_password")
  postgres_password_url_encoded=$(url_encode "$postgres_password")

  tmp_file=$(mktemp "${env_file}.tmp.XXXXXX")
  trap 'rm -f "$tmp_file"' EXIT

  if [ -f "$env_file" ]; then
    awk '
      !/^[[:space:]]*(export[[:space:]]+)?(POSTGRES_PASSWORD|POSTGRES_PASSWORD_URL_ENCODED|HUB_API_KEY|CUBEJS_API_SECRET|CUBEJS_JWT_ISSUER|CUBEJS_JWT_AUDIENCE)[[:space:]]*=/
    ' "$env_file" >"$tmp_file"
  fi

  cat <<EOF >>"$tmp_file"
POSTGRES_PASSWORD=$serialized_postgres_password
POSTGRES_PASSWORD_URL_ENCODED=$postgres_password_url_encoded
HUB_API_KEY=$hub_api_key
CUBEJS_API_SECRET=$cubejs_api_secret
CUBEJS_JWT_ISSUER=formbricks-web
CUBEJS_JWT_AUDIENCE=formbricks-cube
EOF

  append_if_missing "AUTHZED_TOKEN" "$authzed_token"
  append_if_missing "AUTHZED_DATABASE_PASSWORD" "$authzed_database_password"
  append_if_missing "AUTHZED_ENABLED" "true"
  append_if_missing "AUTHZED_CONSISTENCY" "fully_consistent"
  append_if_missing "FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED" "true"

  chmod 600 "$tmp_file"
  mv "$tmp_file" "$env_file"
  trap - EXIT
)

write_base_env_file() {
  local env_file="${1:-.env}"
  local hub_key="$2"
  local cube_secret="$3"
  local authzed_token="$4"
  local authzed_database_password="$5"

  umask 077
  : >"$env_file"
  write_generated_env_file "$env_file" "" "$hub_key" "$cube_secret" "$authzed_token" "$authzed_database_password"
}

# Writes Traefik's static configuration. Both entry points refuse every encoded character Traefik can screen
# request paths for, as Traefik itself did by default until v3.6.7, and as its docs advise whenever a backend may
# decode them: otherwise a router matches one path and the backend acts on another. An encoded slash, for one,
# carried /api%2Fauth/... past the auth routers and their body cap (ENG-3977).
write_traefik_config() {
  local target_path="$1"
  local hsts_enabled="$2"
  local https_setup="$3"
  local email_address="$4"
  local http_redirection=""
  local hsts_middlewares=""
  local cert_resolver=""
  local certificates_resolvers=""
  local encoded_characters="encodedCharacters:
        allowEncodedSlash: false
        allowEncodedBackSlash: false
        allowEncodedNullCharacter: false
        allowEncodedSemicolon: false
        allowEncodedPercent: false
        allowEncodedQuestionMark: false
        allowEncodedHash: false"

  if [[ $hsts_enabled == "y" ]]; then
    hsts_middlewares="middlewares:
        - hstsHeader"
    http_redirection="redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true"
  fi

  if [[ $https_setup == "y" ]]; then
    cert_resolver="certResolver: default"
    certificates_resolvers="certificatesResolvers:
  default:
    acme:
      email: $email_address
      storage: acme.json
      caServer: "https://acme-v02.api.letsencrypt.org/directory"
      tlsChallenge: {}"
  fi

  cat <<EOT >"$target_path"
entryPoints:
  web:
    address: ":80"
    http:
      $http_redirection
      $encoded_characters
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
        $cert_resolver
        options: default
      $hsts_middlewares
      $encoded_characters
providers:
  docker:
    watch: true
    exposedByDefault: false
  file:
    directory: /
$certificates_resolvers
EOT
}

add_formbricks_traefik_labels() {
  local compose_file="${1:-docker-compose.yml}"
  local formbricks_domain_name="$2"
  local formbricks_hsts_enabled="$3"
  local formbricks_https_setup="$4"
  local tmp_file="${compose_file}.tmp"

  if ! awk -v domain_name="$formbricks_domain_name" -v hsts_enabled="$formbricks_hsts_enabled" -v https_setup="$formbricks_https_setup" '
BEGIN { in_formbricks = 0; inserted = 0 }
/^  formbricks:$/ { in_formbricks = 1 }
in_formbricks && /^  [A-Za-z0-9_-]+:/ && !/^  formbricks:$/ { in_formbricks = 0 }
{
    if (in_formbricks && !inserted && $0 ~ /^    environment:$/) {
        print "    labels:"
        print "      - \"traefik.enable=true\""
        print "      - \"traefik.http.routers.formbricks.rule=Host(`" domain_name "`)\""
        print "      - \"traefik.http.routers.formbricks.entrypoints=websecure\""
        print "      - \"traefik.http.routers.formbricks.tls=true\""
        if (https_setup == "y") {
            print "      - \"traefik.http.routers.formbricks.tls.certresolver=default\""
        }
        print "      - \"traefik.http.services.formbricks.loadbalancer.server.port=3000\""
        print "      - \"traefik.http.routers.feedback-records-token.rule=Host(`" domain_name "`) && Path(`/api/v3/feedbackRecords/token`)\""
        print "      - \"traefik.http.routers.feedback-records-token.entrypoints=websecure\""
        print "      - \"traefik.http.routers.feedback-records-token.tls=true\""
        if (https_setup == "y") {
            print "      - \"traefik.http.routers.feedback-records-token.tls.certresolver=default\""
        }
        print "      - \"traefik.http.routers.feedback-records-token.service=formbricks\""
        print "      - \"traefik.http.routers.feedback-records-token.priority=200\""
        # Every /api/auth/* route answers anonymous callers, so Traefik refuses a request body over 1 MiB before it
        # reaches the app (ENG-3977): an edge ceiling, set above the 256 KiB auth limit in the app (ENG-3846). The
        # buffering middleware reads the whole request first (413 past maxRequestBodyBytes), so a slow sender ties
        # up Traefik, bounded by the entrypoint readTimeout, instead of the app. The in-memory request threshold is
        # pinned to the same 1 MiB, so no accepted request body spills to disk. Only auth routes get it (the imports
        # take up to 16 MiB). Priority 1000 beats the catch-all, whose default priority is the length of its Host()
        # rule: at most 261, for a 253-character domain.
        print "      - \"traefik.http.middlewares.auth-body-limit.buffering.maxRequestBodyBytes=1048576\""
        print "      - \"traefik.http.middlewares.auth-body-limit.buffering.memRequestBodyBytes=1048576\""
        print "      - \"traefik.http.routers.formbricks-auth.rule=Host(`" domain_name "`) && PathPrefix(`/api/auth`)\""
        print "      - \"traefik.http.routers.formbricks-auth.entrypoints=websecure\""
        print "      - \"traefik.http.routers.formbricks-auth.tls=true\""
        if (https_setup == "y") {
            print "      - \"traefik.http.routers.formbricks-auth.tls.certresolver=default\""
        }
        print "      - \"traefik.http.routers.formbricks-auth.service=formbricks\""
        print "      - \"traefik.http.routers.formbricks-auth.priority=1000\""
        print "      - \"traefik.http.routers.formbricks-auth.middlewares=auth-body-limit\""
        if (hsts_enabled == "y") {
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000\""
            print "      - \"traefik.http.middlewares.hstsHeader.headers.forceSTSHeader=true\""
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsPreload=true\""
            print "      - \"traefik.http.middlewares.hstsHeader.headers.stsIncludeSubdomains=true\""
        } else {
            print "      - \"traefik.http.routers.formbricks_http.entrypoints=web\""
            print "      - \"traefik.http.routers.formbricks_http.rule=Host(`" domain_name "`)\""
            print "      - \"traefik.http.routers.feedback-records-token-http.rule=Host(`" domain_name "`) && Path(`/api/v3/feedbackRecords/token`)\""
            print "      - \"traefik.http.routers.feedback-records-token-http.entrypoints=web\""
            print "      - \"traefik.http.routers.feedback-records-token-http.service=formbricks\""
            print "      - \"traefik.http.routers.feedback-records-token-http.priority=200\""
            print "      - \"traefik.http.routers.formbricks-auth-http.rule=Host(`" domain_name "`) && PathPrefix(`/api/auth`)\""
            print "      - \"traefik.http.routers.formbricks-auth-http.entrypoints=web\""
            print "      - \"traefik.http.routers.formbricks-auth-http.service=formbricks\""
            print "      - \"traefik.http.routers.formbricks-auth-http.priority=1000\""
            print "      - \"traefik.http.routers.formbricks-auth-http.middlewares=auth-body-limit\""
        }
        inserted = 1
    }
    print
}
END {
    if (!inserted) {
        exit 1
    }
}
' "$compose_file" >"$tmp_file"; then
    rm -f "$tmp_file"
    echo "❌ Failed to add Traefik labels to the formbricks service."
    return 1
  fi

  mv "$tmp_file" "$compose_file"
}

install_formbricks() {
  # Friendly welcome
  echo "🧱 Welcome to the Formbricks Setup Script"
  echo ""
  echo "🛸 Fasten your seatbelts! We're setting up your Formbricks environment on your $ubuntu_version server."
  echo ""

  # Update package list
  echo "🔄 Updating your package list."
  sudo apt-get update >/dev/null 2>&1

  # Install dependencies
  echo "📦 Installing the necessary dependencies."
  sudo apt-get install -y \
    ca-certificates \
    curl \
    jq \
    lsb-release >/dev/null 2>&1

  # Reuse an existing Docker installation instead of replacing it implicitly.
  if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker is already installed."
  else
    # Remove old Docker packages only when Docker is not installed at all.
    echo "⚠️ Legacy Docker-related packages may conflict with Docker CE."
    echo "These packages can also be used outside Docker, so they will only be removed with your consent."
    read -p "Remove legacy packages (docker/docker-engine/docker.io/containerd/runc)? [y/N] " remove_legacy_docker_pkgs
    remove_legacy_docker_pkgs=$(echo "$remove_legacy_docker_pkgs" | tr '[:upper:]' '[:lower:]')
    if [[ "$remove_legacy_docker_pkgs" == "y" || "$remove_legacy_docker_pkgs" == "yes" ]]; then
      echo "🧹 Removing old Docker installations."
      sudo apt-get remove docker docker-engine docker.io containerd runc >/dev/null 2>&1 || true
    else
      echo "⏭️ Skipping legacy package removal."
      echo "If Docker installation fails due to conflicting packages, rerun the script and allow the removal step."
    fi

    echo "📦 Installing Docker-specific dependencies."
    sudo apt-get install -y gnupg >/dev/null 2>&1

    # Set up Docker's official GPG key & stable repository.
    echo "🔑 Adding Docker's official GPG key and setting up the stable repository."
    sudo mkdir -m 0755 -p /etc/apt/keyrings >/dev/null 2>&1
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg >/dev/null 2>&1
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null 2>&1

    # Update package list again after adding the Docker repository.
    echo "🔄 Updating your package list again."
    sudo apt-get update >/dev/null 2>&1

    # Install Docker only when it is not already present on the system.
    echo "🐳 Installing Docker."
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1

    # Test Docker installation.
    echo "🚀 Testing your Docker installation."
    if docker --version >/dev/null 2>&1; then
      echo "🎉 Docker is installed!"
    else
      echo "❌ Docker is not installed. Please install Docker before proceeding."
      exit 1
    fi
  fi

  if ! configure_formbricks_docker_command; then
    echo "❌ Docker is installed, but the daemon is not reachable."
    echo "Please start or fix Docker and rerun this script."
    echo "To avoid modifying an existing Docker setup without your consent, this script will not remove or reinstall Docker automatically."
    exit 1
  fi
  echo "✅ Docker daemon is reachable. Reusing the existing Docker installation."

  if ! run_formbricks_docker_compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose is not available on this system."
    echo "Please install Docker Compose or upgrade Docker so 'docker compose' works, then rerun this script."
    exit 1
  fi
  echo "✅ Docker Compose is available."

  # Adding your user to the Docker group
  echo "🐳 Adding your user to the Docker group to avoid using sudo with docker commands."
  sudo groupadd docker >/dev/null 2>&1 || true
  sudo usermod -aG docker $USER >/dev/null 2>&1

  echo "🎉 Hooray! Docker is all set and ready to go. You're now ready to run your Formbricks instance!"

  mkdir -p formbricks && cd formbricks
  echo "📁 Created Formbricks Quickstart directory at ./formbricks."

  existing_postgres_password=""
  if [ -f ".env" ] || [ -f "docker-compose.yml" ]; then
    if ! existing_postgres_password=$(read_existing_postgres_password ".env" "docker-compose.yml"); then
      echo "Set POSTGRES_PASSWORD in .env manually, then rerun this script."
      exit 1
    fi
  fi

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

  write_traefik_config traefik.yaml "$hsts_enabled" "$https_setup" "$email_address"

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
  echo "   - Workspace logos"
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
  echo "📥 Downloading AuthZed database bootstrap helper..."
  authzed_bootstrap_commit="10d5ad908491a8a818aef3c6ada91fa4fdc30b03"
  authzed_bootstrap_sha256="70975701cdf0dcffef5d3573a7514360e87428bb07cc4bfb4dbf47ae0c2e93a5"
  curl -fsSL -o authzed-postgres-bootstrap.sh \
    "https://raw.githubusercontent.com/formbricks/formbricks/${authzed_bootstrap_commit}/docker/authzed-postgres-bootstrap.sh"
  printf '%s  %s\n' "$authzed_bootstrap_sha256" authzed-postgres-bootstrap.sh | sha256sum --check --status -
  chmod 700 authzed-postgres-bootstrap.sh
  mkdir -p cube/schema
  echo "📥 Downloading Cube.js configuration for XM Suite v5 analytics..."
  for cube_file in "${bundled_cube_files[@]}"; do
    curl -fsSL -o "$cube_file" "$stable_docker_files_url/$cube_file"
  done

  echo "🚙 Updating docker-compose.yml with your custom inputs..."
  sed -i "/WEBAPP_URL:/s|WEBAPP_URL:.*|WEBAPP_URL: \"https://$domain_name\"|" docker-compose.yml
  sed -i "/BETTER_AUTH_URL:/s|BETTER_AUTH_URL:.*|BETTER_AUTH_URL: \"https://$domain_name\"|" docker-compose.yml
  sed -i "/NEXTAUTH_URL:/s|NEXTAUTH_URL:.*|NEXTAUTH_URL: \"https://$domain_name\"|" docker-compose.yml

  # One generated value written under both keys. Two `openssl` calls would hand a fresh install the
  # two-secrets-disagreeing configuration on day one. The legacy key is still written because this
  # script seds a docker-compose.yml freshly downloaded from `stable`, so script and compose file are
  # version-skewed by design: an older compose file has only the legacy key to match.
  auth_secret=$(openssl rand -hex 32)
  sed -i "/BETTER_AUTH_SECRET:$/s/BETTER_AUTH_SECRET:.*/BETTER_AUTH_SECRET: $auth_secret/" docker-compose.yml
  sed -i "/NEXTAUTH_SECRET:$/s/NEXTAUTH_SECRET:.*/NEXTAUTH_SECRET: $auth_secret/" docker-compose.yml
  # Report what actually landed. This script patches a docker-compose.yml downloaded from `stable`, so an
  # older one carries only the legacy key and the first sed matches nothing — claiming success either way
  # would hide an install left with an empty secret.
  if grep -q "BETTER_AUTH_SECRET: $auth_secret" docker-compose.yml; then
    echo "🚗 BETTER_AUTH_SECRET updated successfully!"
  elif grep -q "NEXTAUTH_SECRET: $auth_secret" docker-compose.yml; then
    echo "🚗 NEXTAUTH_SECRET updated successfully!"
  else
    echo "❌ Could not set an auth secret in docker-compose.yml - no BETTER_AUTH_SECRET or NEXTAUTH_SECRET line to update."
    exit 1
  fi

  encryption_key=$(openssl rand -hex 32) && sed -i "/ENCRYPTION_KEY:$/s/ENCRYPTION_KEY:.*/ENCRYPTION_KEY: $encryption_key/" docker-compose.yml
  echo "🚗 ENCRYPTION_KEY updated successfully!"

  cron_secret=$(openssl rand -hex 32) && sed -i "/CRON_SECRET:$/s/CRON_SECRET:.*/CRON_SECRET: $cron_secret/" docker-compose.yml	
  echo "🚗 CRON_SECRET updated successfully!"

  hub_api_key=$(openssl rand -hex 32)
  cubejs_api_secret=$(openssl rand -hex 32)
  authzed_token=$(openssl rand -hex 32)
  authzed_database_password=$(openssl rand -hex 32)
  write_generated_env_file \
    ".env" \
    "$existing_postgres_password" \
    "$hub_api_key" \
    "$cubejs_api_secret" \
    "$authzed_token" \
    "$authzed_database_password"
  if [ -n "$existing_postgres_password" ]; then
    echo "🚗 Preserved the existing PostgreSQL password and AuthZed credentials while refreshing .env."
  else
    echo "🚗 Generated PostgreSQL, Hub, Cube, and AuthZed secrets in .env successfully!"
  fi
  
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

  # Step 1: Add Traefik labels to formbricks service
  if ! add_formbricks_traefik_labels "docker-compose.yml" "$domain_name" "$hsts_enabled" "$https_setup"; then
    exit 1
  fi

  # Step 1a: Traefik is now the only way in, so publish the app's own port on the host's loopback only.
  if ! bind_formbricks_port_to_loopback "docker-compose.yml"; then
    exit 1
  fi
  warn_if_docker_exposes_loopback_ports "${formbricks_docker_command[@]}"

  # Step 1b: Add FeedbackRecords gateway labels to the Hub service.
  awk -v domain_name="$domain_name" -v hsts_enabled="$hsts_enabled" -v https_setup="$https_setup" '
BEGIN { in_hub = 0; inserted = 0 }
/^  hub:/ { in_hub = 1 }
in_hub && /^  [A-Za-z0-9_-]+:/ && !/^  hub:/ { in_hub = 0 }
{
    if (in_hub && !inserted && $0 ~ /^    environment:/) {
        print "    labels:"
        print "      - \"traefik.enable=true\""
        print "      - \"traefik.http.services.feedback-records-hub.loadbalancer.server.port=8080\""
        print "      - \"traefik.http.routers.feedback-records-v3.rule=Host(`" domain_name "`) && PathPrefix(`/api/v3/feedbackRecords`)\""
        print "      - \"traefik.http.routers.feedback-records-v3.entrypoints=websecure\""
        print "      - \"traefik.http.routers.feedback-records-v3.tls=true\""
        if (https_setup == "y") {
            print "      - \"traefik.http.routers.feedback-records-v3.tls.certresolver=default\""
        }
        print "      - \"traefik.http.routers.feedback-records-v3.service=feedback-records-hub\""
        print "      - \"traefik.http.routers.feedback-records-v3.priority=100\""
        print "      - \"traefik.http.routers.feedback-records-v3.middlewares=feedback-records-auth,feedback-records-v3-rewrite,feedback-records-hub-headers\""
        print "      - \"traefik.http.routers.feedback-records-sdk.rule=Host(`" domain_name "`) && PathPrefix(`/v1/feedback-records`)\""
        print "      - \"traefik.http.routers.feedback-records-sdk.entrypoints=websecure\""
        print "      - \"traefik.http.routers.feedback-records-sdk.tls=true\""
        if (https_setup == "y") {
            print "      - \"traefik.http.routers.feedback-records-sdk.tls.certresolver=default\""
        }
        print "      - \"traefik.http.routers.feedback-records-sdk.service=feedback-records-hub\""
        print "      - \"traefik.http.routers.feedback-records-sdk.priority=100\""
        print "      - \"traefik.http.routers.feedback-records-sdk.middlewares=feedback-records-auth,feedback-records-hub-headers\""
        if (hsts_enabled != "y") {
            print "      - \"traefik.http.routers.feedback-records-v3-http.rule=Host(`" domain_name "`) && PathPrefix(`/api/v3/feedbackRecords`)\""
            print "      - \"traefik.http.routers.feedback-records-v3-http.entrypoints=web\""
            print "      - \"traefik.http.routers.feedback-records-v3-http.service=feedback-records-hub\""
            print "      - \"traefik.http.routers.feedback-records-v3-http.priority=100\""
            print "      - \"traefik.http.routers.feedback-records-v3-http.middlewares=feedback-records-auth,feedback-records-v3-rewrite,feedback-records-hub-headers\""
            print "      - \"traefik.http.routers.feedback-records-sdk-http.rule=Host(`" domain_name "`) && PathPrefix(`/v1/feedback-records`)\""
            print "      - \"traefik.http.routers.feedback-records-sdk-http.entrypoints=web\""
            print "      - \"traefik.http.routers.feedback-records-sdk-http.service=feedback-records-hub\""
            print "      - \"traefik.http.routers.feedback-records-sdk-http.priority=100\""
            print "      - \"traefik.http.routers.feedback-records-sdk-http.middlewares=feedback-records-auth,feedback-records-hub-headers\""
        }
        print "      - \"traefik.http.middlewares.feedback-records-auth.forwardauth.address=http://formbricks:3000/api/traefik-auth/feedback-records\""
        print "      - \"traefik.http.middlewares.feedback-records-auth.forwardauth.forwardbody=true\""
        print "      - \"traefik.http.middlewares.feedback-records-auth.forwardauth.maxbodysize=1048576\""
        print "      - \"traefik.http.middlewares.feedback-records-auth.forwardauth.preserverequestmethod=true\""
        print "      - \"traefik.http.middlewares.feedback-records-v3-rewrite.replacepathregex.regex=^/api/v3/feedbackRecords(.*)\""
        print "      - \"traefik.http.middlewares.feedback-records-v3-rewrite.replacepathregex.replacement=/v1/feedback-records$${1}\""
        print "      - \"traefik.http.middlewares.feedback-records-hub-headers.headers.customrequestheaders.Authorization=Bearer ${HUB_API_KEY}\""
        print "      - \"traefik.http.middlewares.feedback-records-hub-headers.headers.customrequestheaders.X-API-Key=\""
        print "      - \"traefik.http.middlewares.feedback-records-hub-headers.headers.customrequestheaders.Cookie=\""
        inserted = 1
    }
    print
}
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
    image: rustfs/rustfs:1.0.0-rc.2@sha256:7d6d361c49c08d427250fb59aae5d78df83d644c3405d9ccf4b21cda0b0692d0
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
    image: rustfs/rc:v0.1.36@sha256:ab024bfebee49a750ce886b4c70963ccd9ddaa03f491704a90710641d7a26699
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
    image: "${traefik_image}"
    restart: always
    container_name: "traefik"
    depends_on:
      - formbricks
      - hub
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
    image: "${traefik_image}"
    restart: always
    container_name: "traefik"
    depends_on:
      - formbricks
      - hub
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

set -e
docker compose up -d postgres authzed-db-bootstrap spicedb-migrate spicedb formbricks-migrate
docker compose wait formbricks-migrate
docker compose --profile authzed-ops run --rm authzed-ops upgrade prepare
docker compose --profile authzed-ops run --rm authzed-ops upgrade check
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

# The override file `docker compose` loads next to a Compose file: the first of these names that exists, in the
# order Compose looks for them. Prints nothing when there is none.
compose_override_file() {
  local dir name
  dir="$(dirname "$1")"
  for name in compose.override.yml compose.override.yaml docker-compose.override.yml docker-compose.override.yaml; do
    if [[ "$dir" != "." ]]; then
      name="$dir/$name"
    fi
    if [[ -f "$name" ]]; then
      echo "$name"
      return
    fi
  done
}

# Renders the Compose project exactly as the update's own `docker compose` commands load it: from the file's
# directory with no -f, so Compose itself picks the files (an override, or COMPOSE_FILE from .env). Extra
# arguments go to `config` (e.g. `--format json formbricks`).
render_compose_project() {
  local compose_dir
  compose_dir="$(dirname "$1")"
  shift
  (cd "$compose_dir" && sudo docker compose config "$@")
}

# Puts rewritten Compose files in place as one transaction: each original is backed up before it is replaced, and
# if a step fails, the files already replaced are restored. Arguments: one <target> <temp> <backup> triple per file.
# Returns 1 on failure, or 2 when a restore failed too and a file must be restored by hand.
replace_compose_files() {
  local triples=("$@")
  local i j failure placed=()

  for ((i = 0; i < ${#triples[@]}; i += 3)); do
    failure=""
    if ! cp -p "${triples[i]}" "${triples[i + 2]}"; then
      failure="back up"
    elif ! mv "${triples[i + 1]}" "${triples[i]}"; then
      failure="write"
    fi
    if [[ -n "$failure" ]]; then
      echo "❌ Could not $failure ${triples[i]}."
      for ((j = 0; j < ${#triples[@]}; j += 3)); do rm -f "${triples[j + 1]}"; done
      restore_compose_files "${placed[@]}" || return 2
      return 1
    fi
    placed+=("${triples[i]}" "${triples[i + 2]}")
  done
}

# Like replace_compose_files, and then restores every file if the project no longer renders or `check` (a function
# given the compose file) rejects the result. Arguments: <compose file> <check> then the triples.
replace_compose_files_validated() {
  local compose_file="$1"
  local check="$2"
  shift 2
  local triples=("$@")
  local i pairs=()

  replace_compose_files "${triples[@]}" || return $?
  for ((i = 0; i < ${#triples[@]}; i += 3)); do
    pairs+=("${triples[i]}" "${triples[i + 2]}")
  done

  if ! render_compose_project "$compose_file" >/dev/null; then
    echo "❌ The updated Compose files are invalid."
    restore_compose_files "${pairs[@]}" || return 2
    return 1
  fi
  if ! "$check" "$compose_file"; then
    restore_compose_files "${pairs[@]}" || return 2
    return 1
  fi
}

# Restores each <target> <backup> pair, saying which it restored and which it could not. Fails if any could not be.
restore_compose_files() {
  local pairs=("$@")
  local i failed=0
  for ((i = 0; i < ${#pairs[@]}; i += 2)); do
    if cp -p "${pairs[i + 1]}" "${pairs[i]}"; then
      echo "   Restored ${pairs[i]} from ${pairs[i + 1]}."
    else
      echo "❌ Could not restore ${pairs[i]}. Restore it from ${pairs[i + 1]} by hand."
      failed=1
    fi
  done
  return "$failed"
}

migrate_legacy_valkey_image() {
  local compose_file="${1:-docker-compose.yml}"
  local backup_file="${compose_file}.before-valkey-8.1.9"
  local temp_file="${compose_file}.tmp"

  if [[ ! -f "$compose_file" ]]; then
    echo "❌ Cannot update Valkey because $compose_file does not exist."
    return 1
  fi

  if ! awk -v legacy_image="$legacy_valkey_image" '
    function indentation(line) {
      match(line, /[^ ]/)
      return RSTART - 1
    }
    /^services:[[:space:]]*$/ {
      in_services=1
      service_indent=-1
      next
    }
    in_services && /^[^[:space:]#]/ {
      in_services=0
      in_redis=0
    }
    in_services && /^[ ]+[A-Za-z0-9_-]+:[[:space:]]*$/ {
      line_indent=indentation($0)
      if (service_indent < 0) service_indent=line_indent
      if (line_indent == service_indent) in_redis=($0 ~ /^[ ]+redis:[[:space:]]*$/)
    }
    in_redis && /^[[:space:]]+image:[[:space:]]*/ && index($0, legacy_image) { found=1 }
    END { exit(found ? 0 : 1) }
  ' "$compose_file"; then
    return 0
  fi

  cp -p "$compose_file" "$temp_file"

  if ! awk -v legacy_image="$legacy_valkey_image" -v replacement_image="$multi_arch_valkey_image" '
    function indentation(line) {
      match(line, /[^ ]/)
      return RSTART - 1
    }
    /^services:[[:space:]]*$/ {
      in_services=1
      service_indent=-1
    }
    in_services && /^[^[:space:]#]/ && !/^services:[[:space:]]*$/ {
      in_services=0
      in_redis=0
    }
    in_services && /^[ ]+[A-Za-z0-9_-]+:[[:space:]]*$/ {
      line_indent=indentation($0)
      if (service_indent < 0) service_indent=line_indent
      if (line_indent == service_indent) in_redis=($0 ~ /^[ ]+redis:[[:space:]]*$/)
    }
    in_redis && /^[[:space:]]+image:[[:space:]]*/ && index($0, legacy_image) {
      sub(legacy_image, replacement_image)
      replacements++
    }
    { print }
    END { exit(replacements == 1 ? 0 : 1) }
  ' "$compose_file" >"$temp_file"; then
    rm -f "$temp_file"
    echo "❌ Could not update the bundled Valkey image. The original Compose file is unchanged."
    return 1
  fi

  if ! replace_compose_files_validated "$compose_file" true "$compose_file" "$temp_file" "$backup_file"; then
    return 1
  fi

  echo "✅ Updated bundled Valkey to the native amd64/arm64 image. Backup: $backup_file"
}

# Writes <file> to <output> with the formbricks service's bare published `3000:3000` bound to `127.0.0.1`.
# Returns 0 when it rewrote one, 3 when there was nothing to rewrite, anything else on failure (<output> removed).
# Only the bare mapping is rewritten, keeping a trailing comment; a host IP or port the operator chose is theirs.
rewrite_formbricks_port_to_loopback() {
  local file="$1"
  local output="$2"

  local rewrite_program='
    function indentation(line) {
      match(line, /[^ ]/)
      return RSTART - 1
    }
    /^services:[[:space:]]*(#.*)?$/ {
      in_services=1
      in_formbricks=0
      in_ports=0
      service_indent=-1
      print
      next
    }
    in_services && /^[^[:space:]#]/ {
      in_services=0
      in_formbricks=0
      in_ports=0
    }
    # Any content line at the services level starts a service, so a header in an unusual form (a tag, a dotted
    # anchor) still ends the one before it. Only the direct children of formbricks can be its ports: key, which
    # keeps a nested deploy: ports: or the text of a block scalar out of it.
    in_services && /^[ ]*[^[:space:]#]/ {
      line_indent=indentation($0)
      if (service_indent < 0) service_indent=line_indent
      if (line_indent <= service_indent) {
        in_formbricks=($0 ~ /^[ ]+["\047]?formbricks["\047]?:[[:space:]]*(&[^[:space:]]+)?[[:space:]]*(#.*)?\r?$/)
        child_indent=-1
        in_ports=0
      } else if (in_formbricks && child_indent < 0) {
        child_indent=line_indent
      }
    }
    in_formbricks && indentation($0) == child_indent && /^[ ]+ports:[[:space:]]*(#.*)?\r?$/ {
      in_ports=1
      ports_indent=indentation($0)
      print
      next
    }
    in_ports && /^[ ]*[^[:space:]#]/ && indentation($0) <= ports_indent && $0 !~ /^[ ]*-/ { in_ports=0 }
    in_ports && /^[ ]*-[[:space:]]*/ {
      match($0, /^[ ]*-[[:space:]]*/)
      prefix=substr($0, 1, RLENGTH)
      value=substr($0, RLENGTH + 1)
      # Keep a CRLF line ending on the rewritten line.
      eol=(value ~ /\r$/) ? "\r" : ""
      sub(/[[:space:]]+$/, "", value)
      # Split off a trailing YAML comment: after the closing quote, or after whitespace in a plain scalar.
      rest=""
      quote=""
      first=substr(value, 1, 1)
      if (first == "\"" || first == "\047") {
        close_at=index(substr(value, 2), first)
        if (close_at > 0) {
          quote=first
          rest=substr(value, close_at + 2)
          value=substr(value, 2, close_at - 1)
        }
      } else if (match(value, /[[:space:]]+#/)) {
        rest=substr(value, RSTART)
        value=substr(value, 1, RSTART - 1)
      }
      if (rest ~ /^([[:space:]]+#.*)?$/ && (value == "3000:3000" || value == "3000:3000/tcp")) {
        suffix=(value == "3000:3000/tcp") ? "/tcp" : ""
        # Compose recommends quoting port mappings; an unquoted one gets double quotes.
        if (quote == "") quote="\""
        print prefix quote "127.0.0.1:3000:3000" suffix quote rest eol
        replacements++
        next
      }
    }
    { print }
    END { exit(replacements > 0 ? 0 : 3) }
  '

  # Written into a `cp -p` copy so the result keeps the original's mode: the file holds secrets. If that copy
  # fails, awk would create the output with the default umask, so stop before writing anything.
  if ! cp -p "$file" "$output"; then
    rm -f "$output"
    return 1
  fi
  local status=0
  awk "$rewrite_program" "$file" >"$output" || status=$?
  if [[ $status -ne 0 ]]; then
    rm -f "$output"
  fi
  return "$status"
}

# Accepts the rendered project only when the formbricks service publishes host port 3000 exactly once, on
# 127.0.0.1: the outcome the narrowing is for. Anything else means it did not take effect in the files Compose
# actually loads (say, a compose.yaml it prefers over docker-compose.yml), or that two bindings would collide,
# which the update would only find out after stopping the stack. The rare pairs that could coexist (TCP and
# UDP, two addresses) are rejected too, which only means the port stays as it was.
formbricks_port_on_loopback_only() {
  local rendered
  rendered=$(render_compose_project "$1" --format json formbricks) || return 1
  # Each port is a flat JSON object, so with whitespace dropped (whatever Compose's formatting), an innermost
  # {...} holding "published":"3000" is one binding of host port 3000.
  local bindings
  bindings=$(printf '%s' "$rendered" | tr -d '[:space:]' | grep -oE '\{[^{}]*\}' |
    grep -E '"published":"?3000"?[,}]' || true)
  local count loopback
  count=$(printf '%s' "$bindings" | grep -c . || true)
  loopback=$(printf '%s' "$bindings" | grep -c '"host_ip":"127\.0\.0\.1"' || true)
  if [[ "$count" -gt 1 ]]; then
    echo "❌ The formbricks service would publish port 3000 more than once."
    return 1
  fi
  if [[ "$count" -ne 1 || "$loopback" -ne 1 ]]; then
    echo "❌ The Compose files Docker Compose loads would not publish port 3000 on 127.0.0.1 only."
    return 1
  fi
}

# Narrows the formbricks service's published port from `3000:3000` (every interface) to `127.0.0.1:3000:3000`
# (ENG-3983). In the one-click setup Traefik reaches the app over the Compose network, so the published port is
# only ever needed on the host itself; on any other interface it is a way around Traefik and everything it
# enforces (TLS, request limits, the forwarding headers the app trusts). Docker-published ports also skip UFW.
# An override file beside it is narrowed too, so the merged project does not publish the port twice. With
# "validate" (the update path) every changed file is backed up, and all are restored if the merged project does
# not render or would not publish the port on 127.0.0.1 only. Returns 2 when a restore failed and the files are unsafe.
bind_formbricks_port_to_loopback() {
  local compose_file="${1:-docker-compose.yml}"
  local mode="${2:-}"

  if [[ ! -f "$compose_file" ]]; then
    echo "❌ Cannot narrow the Formbricks port because $compose_file does not exist."
    return 1
  fi

  # COMPOSE_FILE in .env changes which files `docker compose` loads, so the files to narrow are unknown. Compose
  # accepts both `=` and `:` there.
  local env_file
  env_file="$(dirname "$compose_file")/.env"
  if [[ "$mode" == "validate" && -f "$env_file" ]] &&
    grep -qE '^[[:space:]]*(export[[:space:]]+)?COMPOSE_FILE[[:space:]]*[=:]' "$env_file"; then
    echo "⚠️ .env sets COMPOSE_FILE, so the update cannot tell which files Docker Compose loads."
    return 1
  fi

  local files=("$compose_file")
  local override_file
  override_file="$(compose_override_file "$compose_file")"
  if [[ -n "$override_file" ]]; then
    files+=("$override_file")
  fi

  local file status i triples=() rewritten=()
  for file in "${files[@]}"; do
    status=0
    rewrite_formbricks_port_to_loopback "$file" "${file}.tmp" || status=$?
    if [[ $status -eq 0 ]]; then
      triples+=("$file" "${file}.tmp" "${file}.before-loopback-port")
      rewritten+=("$file")
    elif [[ $status -ne 3 ]]; then
      echo "❌ Could not narrow the Formbricks port in $file. Nothing was changed."
      for ((i = 0; i < ${#triples[@]}; i += 3)); do rm -f "${triples[i + 1]}"; done
      return 1
    fi
  done
  if [[ ${#triples[@]} -eq 0 ]]; then
    return 0
  fi

  if [[ "$mode" != "validate" ]]; then
    # The installer has just written docker-compose.yml, so it needs no backup; an override kept from an earlier
    # install is the operator's and does.
    if [[ "${rewritten[*]}" == "$compose_file" ]]; then
      if ! mv "${triples[1]}" "${triples[0]}"; then
        rm -f "${triples[1]}"
        echo "❌ Could not write ${triples[0]}. It is unchanged."
        return 1
      fi
      return 0
    fi
    replace_compose_files "${triples[@]}" || return $?
    echo "🔒 Published port 3000 on 127.0.0.1 only in ${rewritten[*]} (each kept as <file>.before-loopback-port)."
    return 0
  fi

  replace_compose_files_validated "$compose_file" formbricks_port_on_loopback_only "${triples[@]}" || return $?

  echo "🔒 From this update on, Formbricks publishes port 3000 on 127.0.0.1 only. Traefik still serves it on 80/443."
  echo "   Changed: ${rewritten[*]} (each kept as <file>.before-loopback-port). To reach port 3000 from"
  echo "   other machines on purpose, publish it on an explicit address instead, such as - 0.0.0.0:3000:3000."
}

# Whether this Docker Engine keeps a port published on 127.0.0.1 off the local network. Before 28.0, hosts on the
# same L2 segment could reach it (moby/moby#45610); 28.2.0 to 28.3.2 lost that protection on a firewalld reload
# (CVE-2025-54388). An unknown version is given the benefit of the doubt.
docker_engine_isolates_loopback_ports() {
  local version="${1%%[-+]*}"
  local major minor patch
  IFS=. read -r major minor patch <<<"$version"
  [[ "$major" =~ ^[0-9]+$ && "${minor:-0}" =~ ^[0-9]+$ && "${patch:-0}" =~ ^[0-9]+$ ]] || return 0
  local numeric=$((major * 10000 + ${minor:-0} * 100 + ${patch:-0}))
  ((numeric >= 280000)) || return 1
  ((numeric < 280200 || numeric >= 280303))
}

# Arguments: the docker command to ask (default: sudo docker).
warn_if_docker_exposes_loopback_ports() {
  local docker_command=("$@")
  if [[ ${#docker_command[@]} -eq 0 ]]; then
    docker_command=(sudo docker)
  fi
  local version
  version=$("${docker_command[@]}" version --format '{{.Server.Version}}' 2>/dev/null) || return 0
  if ! docker_engine_isolates_loopback_ports "$version"; then
    echo "⚠️ Docker Engine $version can let machines on your local network reach ports published on 127.0.0.1."
    echo "   Upgrade Docker Engine to 28.3.3 or later to keep port 3000 private to this server."
  fi
}

# The git ref holding the Cube model that matches the Formbricks image: its release tag when the image is pinned
# to one, stable for latest. Prints nothing when the image names no single release, such as a digest pin.
formbricks_release_ref() {
  local images tag

  images=$(sudo docker compose config --images 2>/dev/null | grep -E '^ghcr\.io/formbricks/formbricks([:@]|$)' | sort -u) || true
  # The app, migration and AuthZed services share the image; if they disagree there is no one release to match.
  [[ -n "$images" && "$images" != *$'\n'* ]] || return 0

  case "$images" in
    ghcr.io/formbricks/formbricks | ghcr.io/formbricks/formbricks:latest) echo "stable" ;;
    ghcr.io/formbricks/formbricks:*)
      # A tag that also carries a digest runs whatever the digest names, so it is not trusted as the release.
      tag="${images#ghcr.io/formbricks/formbricks:}"
      if [[ "$tag" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then echo "$tag"; fi
      ;;
  esac
}

has_bundled_cube_model() {
  local cube_file

  for cube_file in "${bundled_cube_files[@]}"; do
    [[ -f "$cube_file" ]] || return 1
  done
}

keep_current_cube_model() {
  local reason="$1"

  rm -rf cube/.download
  echo "⚠️ $reason, so the Cube model was left as it was. Once that is fixed, refresh it with:"
  # The updater is started from the directory above this one, so the command enters it first.
  echo "   cd $(printf '%q' "$(dirname "$PWD")") && ./formbricks.sh refresh-cube"
}

# Only install downloaded the Cube model, so an update kept serving the previous release's model to the new
# app, whose charts query members that model lacks (ENG-3951). The files are one model, so they change together
# or not at all: on any failure both stay as they were, which Cube still starts with. Returns 1 when the model
# was not refreshed.
refresh_bundled_cube_files() {
  local cube_file replaced_file release_ref files_url changed=false replaced=()
  # Both outside cube/schema, which Cube loads as a whole.
  local staging_dir="cube/.download" backup_dir="cube/previous"

  # Installations that run Cube elsewhere have no bundled model to refresh.
  has_bundled_cube_model || return 0

  release_ref=$(formbricks_release_ref)
  if [[ -z "$release_ref" ]]; then
    echo "⚠️ The Formbricks image is not pinned to latest or a release tag, so the Cube model files were left as they were."
    echo "   To match them to your image: https://formbricks.com/docs/self-hosting/advanced/migration#cube-model-files-for-docker"
    return 1
  fi
  files_url="https://raw.githubusercontent.com/formbricks/formbricks/$release_ref/docker"

  rm -rf "$staging_dir"
  for cube_file in "${bundled_cube_files[@]}"; do
    if ! { mkdir -p "$(dirname "$staging_dir/${cube_file#cube/}")" &&
      curl -fsSL -o "$staging_dir/${cube_file#cube/}" "$files_url/$cube_file"; }; then
      keep_current_cube_model "Could not download $cube_file from $release_ref"
      return 1
    fi
    cmp -s "$staging_dir/${cube_file#cube/}" "$cube_file" || changed=true
  done
  if [[ "$changed" == false ]]; then
    rm -rf "$staging_dir"
    return 0
  fi

  for cube_file in "${bundled_cube_files[@]}"; do
    if ! { mkdir -p "$(dirname "$backup_dir/${cube_file#cube/}")" &&
      cp -p "$cube_file" "$backup_dir/${cube_file#cube/}"; }; then
      keep_current_cube_model "Could not back up $cube_file to $backup_dir/"
      return 1
    fi
  done

  for cube_file in "${bundled_cube_files[@]}"; do
    if ! mv "$staging_dir/${cube_file#cube/}" "$cube_file"; then
      # Put back what was already replaced, so Cube never starts with half of each model.
      for replaced_file in "${replaced[@]}"; do
        if ! cp -p "$backup_dir/${replaced_file#cube/}" "$replaced_file"; then
          # The update still goes on: stopping here would leave all of Formbricks down, not just Cube.
          rm -rf "$staging_dir"
          echo "❌ Could not replace $cube_file or restore $replaced_file, so the Cube model files are from different releases. Once that is fixed, put the previous model back with:"
          echo "   cd $(printf '%q' "$PWD") && cp -p $backup_dir/${replaced_file#cube/} $replaced_file && sudo docker compose up -d --force-recreate cube"
          return 1
        fi
      done
      keep_current_cube_model "Could not replace $cube_file"
      return 1
    fi
    replaced+=("$cube_file")
  done

  rm -rf "$staging_dir"
  echo "✅ Updated the Cube model to $release_ref. Previous files: $backup_dir/"
}

refresh_cube_model() {
  echo "🔄 Refreshing the bundled Cube model..."
  cd formbricks

  if ! has_bundled_cube_model; then
    echo "This installation has no bundled Cube model to refresh."
    return 0
  fi
  if ! refresh_bundled_cube_files; then
    exit 1
  fi
  sudo docker compose up -d --force-recreate cube
  echo "🎉 Cube now serves the refreshed model."
}

update_formbricks() {
  echo "🔄 Updating Formbricks..."
  cd formbricks

  local compose_services
  if ! compose_services=$(sudo docker compose config --services); then
    echo "❌ Could not render docker-compose.yml. No images were pulled and no services were stopped." >&2
    echo "Fix the Compose error, run 'docker compose config', and retry the update." >&2
    exit 1
  fi

  if ! printf '%s\n' "$compose_services" | grep -Fxq "hub-worker"; then
    echo "⚠️ This installation does not contain the Hub worker service, so Hub webhook deliveries and enrichment jobs will stay queued."
    echo "Continuing the update. Adding the worker is recommended; from the next major release the updater will require it."
    echo "https://formbricks.com/docs/self-hosting/advanced/migration#hub-worker-for-docker"
  fi

  if ! grep -Eq '^  authzed-ops:$' docker-compose.yml || ! grep -Eq '^  spicedb:$' docker-compose.yml; then
    echo "❌ This installation does not yet contain the AuthZed v6 Compose services."
    echo "Your customized Compose file was not changed. Follow the v6 AuthZed migration guide before updating:"
    echo "https://formbricks.com/docs/self-hosting/advanced/authzed-operations#upgrade-an-existing-installation-to-v6"
    exit 1
  fi

  if ! grep -Eq '^FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true$' .env; then
    echo "❌ The AuthZed v6 migration has not been acknowledged for this installation."
    echo "Back up PostgreSQL, add the documented AuthZed services and secrets, then run the upgrade preparation."
    echo "After its final check is clean, set FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true in .env and retry."
    echo "https://formbricks.com/docs/self-hosting/advanced/authzed-operations#upgrade-an-existing-installation-to-v6"
    exit 1
  fi

  # Rewrites the operator's Compose file, so it runs only once every check that can stop the update has
  # passed: a failed gate must not leave them a modified file to reason about.
  migrate_legacy_valkey_image docker-compose.yml

  sudo docker compose pull
  # Preparation is an explicit maintenance operation. Never run target-version
  # database migrations or schema/relationship writes against the still-running app.
  sudo docker compose --profile authzed-ops run --rm --no-deps authzed-ops upgrade check
  # After the last gate that can stop the update, so the narrowing is never announced and then left unapplied:
  # the `up -d` below is what recreates the container with the new binding. A failure has already restored the
  # original files, so it never holds back the update itself, unless a restore failed too: then the files may not
  # start, so stop while the stack is still running.
  local port_status=0
  bind_formbricks_port_to_loopback docker-compose.yml validate || port_status=$?
  if [[ $port_status -eq 2 ]]; then
    echo "❌ Stopped the update before touching the running stack. Restore the files above, then rerun it."
    exit 1
  elif [[ $port_status -ne 0 ]]; then
    echo "⚠️ Continuing the update with port 3000 published as before."
  fi
  warn_if_docker_exposes_loopback_ports
  sudo docker compose down
  # Past every gate and with Cube stopped, so the next start serves the release's model. A failed refresh leaves
  # the previous model, which Cube still starts with, so it never stops the update.
  refresh_bundled_cube_files || true
  sudo docker compose up -d --wait postgres
  sudo docker compose run --rm --no-deps formbricks-migrate
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
  refresh-cube)
    refresh_cube_model
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
