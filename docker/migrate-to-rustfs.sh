#!/bin/env bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MC_IMAGE="minio/mc@sha256:95b5f3f7969a5c5a9f3a700ba72d5c84172819e13385aaf916e237cf111ab868"
RUSTFS_IMAGE="rustfs/rustfs:1.0.0-alpha.93"

print_status() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

compose_network_flag() {
  local name
  name="$(docker network ls --format '{{.Name}}' | awk -v d="$(basename "$PWD")" '$0==d"_default"{print; exit}')" || true
  if [[ -n "$name" ]]; then
    echo --network "$name"
  fi
}

read_compose_value() {
  local key="$1"
  local val
  val=$(sed -n "s/^[[:space:]]*$key:[[:space:]]*\"\(.*\)\"[[:space:]]*$/\1/p" docker-compose.yml | head -n 1)
  if [[ -z "$val" ]]; then
    val=$(sed -n "s/^[[:space:]]*$key:[[:space:]]*\([^#][^[:space:]]*\)[[:space:]]*$/\1/p" docker-compose.yml | head -n 1)
  fi
  echo "$val"
}

read_dotenv_value() {
  local key="$1"
  local env_file="${2:-.env}"

  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  sed -n "s/^${key}=\(.*\)$/\1/p" "$env_file" | head -n 1
}

resolve_compose_reference() {
  local value="$1"

  if [[ "$value" =~ ^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$ ]]; then
    read_dotenv_value "${BASH_REMATCH[1]}"
    return 0
  fi

  if [[ "$value" =~ ^\$([A-Za-z_][A-Za-z0-9_]*)$ ]]; then
    read_dotenv_value "${BASH_REMATCH[1]}"
    return 0
  fi

  echo "$value"
}

read_compose_resolved_value() {
  local key="$1"
  resolve_compose_reference "$(read_compose_value "$key")"
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

has_service() {
  grep -q "^  $1:[[:space:]]*$" docker-compose.yml
}

check_formbricks_directory() {
  if [[ -f "docker-compose.yml" ]]; then
    if grep -q "formbricks" docker-compose.yml; then
      return 0
    fi
    print_error "This doesn't appear to be a Formbricks docker-compose.yml file."
    exit 1
  fi

  if [[ -f "formbricks/docker-compose.yml" ]]; then
    cd formbricks
    print_status "Detected one-click setup layout. Switched to ./formbricks directory."
    if ! grep -q "formbricks" docker-compose.yml; then
      print_error "This doesn't appear to be a Formbricks docker-compose.yml file."
      exit 1
    fi
    return 0
  fi

  print_error "docker-compose.yml not found in the current directory or ./formbricks/"
  exit 1
}

backup_docker_compose() {
  local backup_file="docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)"
  cp docker-compose.yml "$backup_file"
  print_status "Backed up docker-compose.yml to $backup_file"
}

detect_https_setup() {
  if grep -q "websecure" docker-compose.yml || grep -q "certresolver" docker-compose.yml; then
    echo "y"
  else
    echo "n"
  fi
}

get_main_domain() {
  local domain=""
  if grep -q "WEBAPP_URL:" docker-compose.yml; then
    domain=$(grep "WEBAPP_URL:" docker-compose.yml | sed 's/.*WEBAPP_URL: *"\([^"]*\)".*/\1/' 2>/dev/null)
    if [[ -z "$domain" ]]; then
      domain=$(grep "WEBAPP_URL:" docker-compose.yml | sed 's/.*WEBAPP_URL: *\([^[:space:]]*\).*/\1/')
    fi
    domain=$(echo "$domain" | sed -e 's|https://||' -e 's|http://||')
  fi
  echo "$domain"
}

add_or_replace_env_var() {
  local key="$1"
  local value="$2"

  if grep -q "^[[:space:]]*$key:" docker-compose.yml; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^\([[:space:]]*$key:\).*|\1 \"$value\"|" docker-compose.yml
    else
      sed -i '' "s|^\([[:space:]]*$key:\).*|\1 \"$value\"|" docker-compose.yml
    fi
  elif grep -q "^[[:space:]]*#[[:space:]]*$key:" docker-compose.yml; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^[[:space:]]*#[[:space:]]*$key:.*|    $key: \"$value\"|" docker-compose.yml
    else
      sed -i '' "s|^[[:space:]]*#[[:space:]]*$key:.*|    $key: \"$value\"|" docker-compose.yml
    fi
  else
    awk -v insert_key="$key" -v insert_val="$value" '
      /^  environment:/ {print; in_env=1; next}
      in_env && /^[^[:space:]]/ {
        if (!printed) { print "    " insert_key ": \"" insert_val "\""; printed=1 }
        in_env=0
      }
      { print }
      END { if(in_env && !printed) print "    " insert_key ": \"" insert_val "\"" }
    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
  fi
}

external_s3_guard() {
  local acc sec
  acc=$(read_compose_resolved_value "S3_ACCESS_KEY")
  sec=$(read_compose_resolved_value "S3_SECRET_KEY")

  if has_service minio; then
    print_warning "Detected bundled MinIO in docker-compose.yml."
    print_error "This helper does not migrate MinIO-backed installs to RustFS."
    print_info "Use this script only for setups that still store uploads locally."
    exit 0
  fi

  if [[ -n "$acc" && -n "$sec" ]] && ! has_service rustfs; then
    print_warning "Detected existing S3 credentials without bundled RustFS."
    print_error "This helper is intended only for local-upload installs."
    print_info "If you already use AWS S3 or another S3-compatible provider, no migration is needed."
    exit 0
  fi
}

generate_rustfs_credentials() {
  local existing_s3_access existing_s3_secret existing_bucket existing_endpoint
  local existing_admin_user existing_admin_password

  existing_s3_access=$(read_compose_resolved_value "S3_ACCESS_KEY")
  existing_s3_secret=$(read_compose_resolved_value "S3_SECRET_KEY")
  existing_bucket=$(read_compose_resolved_value "S3_BUCKET_NAME")
  existing_endpoint=$(read_compose_resolved_value "S3_ENDPOINT_URL")
  existing_admin_user=$(read_compose_resolved_value "RUSTFS_ACCESS_KEY")
  existing_admin_password=$(read_compose_resolved_value "RUSTFS_SECRET_KEY")

  rustfs_service_user="${existing_s3_access:-formbricks-service-$(openssl rand -hex 4)}"
  rustfs_service_password="${existing_s3_secret:-$(openssl rand -base64 20)}"
  rustfs_bucket_name="${existing_bucket:-formbricks-uploads}"
  rustfs_policy_name="formbricks-policy"
  rustfs_admin_user="${existing_admin_user:-formbricks-$(openssl rand -hex 4)}"
  rustfs_admin_password="${existing_admin_password:-$(openssl rand -base64 20)}"
  rustfs_existing_endpoint="$existing_endpoint"
}

add_rustfs_environment_variables() {
  local files_domain="$1"
  local https_setup="$2"
  local s3_endpoint_url=""

  if [[ "$https_setup" == "y" ]]; then
    s3_endpoint_url="https://$files_domain"
  else
    s3_endpoint_url="http://$files_domain"
  fi

  write_rustfs_env_file ".env"
  add_or_replace_env_var "S3_ACCESS_KEY" '${FORMBRICKS_RUSTFS_SERVICE_USER}'
  add_or_replace_env_var "S3_SECRET_KEY" '${FORMBRICKS_RUSTFS_SERVICE_PASSWORD}'
  add_or_replace_env_var "S3_REGION" '${FORMBRICKS_RUSTFS_REGION}'
  add_or_replace_env_var "S3_BUCKET_NAME" '${FORMBRICKS_RUSTFS_BUCKET_NAME}'
  add_or_replace_env_var "S3_ENDPOINT_URL" "$s3_endpoint_url"
  add_or_replace_env_var "S3_FORCE_PATH_STYLE" "1"

  print_status "S3 environment variables ensured in docker-compose.yml"
  print_status "RustFS credentials stored in .env with permissions set to 600"
}

add_rustfs_services() {
  local files_domain="$1"
  local main_domain="$2"
  local https_setup="$3"

  if has_service rustfs && has_service rustfs-init && has_service rustfs-perms; then
    print_info "RustFS services already present. Skipping service injection."
    return 0
  fi

  local traefik_entrypoints cors_origin tls_block
  if [[ "$https_setup" == "y" ]]; then
    traefik_entrypoints="websecure"
    cors_origin="https://$main_domain"
    tls_block=$'      - "traefik.http.routers.rustfs-s3.tls=true"\n      - "traefik.http.routers.rustfs-s3.tls.certresolver=default"'
  else
    traefik_entrypoints="web"
    cors_origin="http://$main_domain"
    tls_block=""
  fi

  cat > rustfs_service.tmp <<EOF

  rustfs-perms:
    image: busybox:1.36.1
    user: "0:0"
    command: ["sh", "-c", "mkdir -p /data && chown -R 10001:10001 /data"]
    volumes:
      - rustfs-data:/data

  rustfs:
    restart: always
    image: $RUSTFS_IMAGE
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
      - "traefik.http.routers.rustfs-s3.rule=Host(\`$files_domain\`)"
      - "traefik.http.routers.rustfs-s3.entrypoints=$traefik_entrypoints"
$tls_block
      - "traefik.http.routers.rustfs-s3.service=rustfs-s3"
      - "traefik.http.services.rustfs-s3.loadbalancer.server.port=9000"
      - "traefik.http.routers.rustfs-s3.middlewares=rustfs-cors,rustfs-ratelimit"
      - "traefik.http.middlewares.rustfs-cors.headers.accesscontrolallowmethods=GET,PUT,POST,DELETE,HEAD,OPTIONS"
      - "traefik.http.middlewares.rustfs-cors.headers.accesscontrolallowheaders=*"
      - "traefik.http.middlewares.rustfs-cors.headers.accesscontrolalloworiginlist=$cors_origin"
      - "traefik.http.middlewares.rustfs-cors.headers.accesscontrolmaxage=100"
      - "traefik.http.middlewares.rustfs-cors.headers.addvaryheader=true"
      - "traefik.http.middlewares.rustfs-ratelimit.ratelimit.average=100"
      - "traefik.http.middlewares.rustfs-ratelimit.ratelimit.burst=200"

  rustfs-init:
    image: $MC_IMAGE
    depends_on:
      - rustfs
    environment:
      RUSTFS_ADMIN_USER: "\${FORMBRICKS_RUSTFS_ADMIN_USER}"
      RUSTFS_ADMIN_PASSWORD: "\${FORMBRICKS_RUSTFS_ADMIN_PASSWORD}"
      RUSTFS_SERVICE_USER: "\${FORMBRICKS_RUSTFS_SERVICE_USER}"
      RUSTFS_SERVICE_PASSWORD: "\${FORMBRICKS_RUSTFS_SERVICE_PASSWORD}"
      RUSTFS_BUCKET_NAME: "\${FORMBRICKS_RUSTFS_BUCKET_NAME}"
      RUSTFS_POLICY_NAME: "\${FORMBRICKS_RUSTFS_POLICY_NAME}"
    entrypoint:
      - /bin/sh
      - -c
      - |
        set -e
        attempts=0
        max_attempts=30
        until mc alias set rustfs http://rustfs:9000 "\$RUSTFS_ADMIN_USER" "\$RUSTFS_ADMIN_PASSWORD" >/dev/null 2>&1 \
          && mc ls rustfs >/dev/null 2>&1; do
          attempts=\$((attempts + 1))
          if [ "\$attempts" -ge "\$max_attempts" ]; then
            echo "RustFS did not become ready within \${max_attempts} attempts"
            exit 1
          fi
          sleep 2
        done
        mc mb rustfs/"\$RUSTFS_BUCKET_NAME" --ignore-existing
        cat > /tmp/formbricks-policy.json << POLICY_EOF
        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
              "Resource": ["arn:aws:s3:::\$RUSTFS_BUCKET_NAME/*"]
            },
            {
              "Effect": "Allow",
              "Action": ["s3:ListBucket"],
              "Resource": ["arn:aws:s3:::\$RUSTFS_BUCKET_NAME"]
            }
          ]
        }
        POLICY_EOF
        if ! mc admin policy info rustfs "\$RUSTFS_POLICY_NAME" >/dev/null 2>&1; then
          mc admin policy create rustfs "\$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json || \
            mc admin policy add rustfs "\$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json
        fi
        if ! mc admin user info rustfs "\$RUSTFS_SERVICE_USER" >/dev/null 2>&1; then
          mc admin user add rustfs "\$RUSTFS_SERVICE_USER" "\$RUSTFS_SERVICE_PASSWORD"
        fi
        mc admin policy attach rustfs "\$RUSTFS_POLICY_NAME" --user "\$RUSTFS_SERVICE_USER"
EOF

  awk '
    {
      print
      if ($0 ~ /^services:$/ && !inserted) {
        while ((getline line < "rustfs_service.tmp") > 0) print line
        close("rustfs_service.tmp")
        inserted = 1
      }
    }
  ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

  rm -f rustfs_service.tmp
  print_status "Added RustFS services to docker-compose.yml"
}

add_rustfs_volume() {
  if grep -q '^volumes:' docker-compose.yml; then
    if awk '/^volumes:/{invol=1; next} invol && NF==0{invol=0} invol{ if($1=="rustfs-data:") found=1 } END{ exit(!found) }' docker-compose.yml; then
      print_info "rustfs-data volume already present."
    else
      awk '
        /^volumes:/ { print; invol=1; next }
        invol && /^[^[:space:]]/ { if(!added){ print "  rustfs-data:"; print "    driver: local"; added=1 } ; invol=0 }
        { print }
        END { if (invol && !added) { print "  rustfs-data:"; print "    driver: local" } }
      ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
      print_status "rustfs-data volume ensured"
    fi
  else
    {
      echo ""
      echo "volumes:"
      echo "  rustfs-data:"
      echo "    driver: local"
    } >> docker-compose.yml
    print_status "Added volumes section with rustfs-data"
  fi
}

ensure_service_dependency() {
  local service="$1"
  local dependency="$2"
  local condition="${3:-}"
  local optional="${4:-false}"

  if ! grep -q "^  $service:[[:space:]]*$" docker-compose.yml; then
    if [[ "$optional" == "true" ]]; then
      print_info "$service service not found - skipping dependency addition."
      return 0
    fi

    print_error "$service service not found in docker-compose.yml!"
    print_info "Please ensure the $service service is properly configured before running this migration."
    exit 1
  fi

  if awk -v srv="$service" -v dep="$dependency" '
    BEGIN { in_svc=0; in_dep=0; found=0 }
    $0 ~ "^  " srv ":[[:space:]]*$" {
      in_svc=1
      next
    }
    in_svc && $0 ~ /^  [A-Za-z0-9_-]+:[[:space:]]*$/ && $0 !~ "^  " srv ":[[:space:]]*$" {
      in_svc=0
      in_dep=0
    }
    in_svc && $0 ~ /^    depends_on:[[:space:]]*$/ {
      in_dep=1
      next
    }
    in_dep && $0 ~ "^[[:space:]]*-[[:space:]]*" dep "[[:space:]]*$" {
      found=1
      next
    }
    in_dep && $0 ~ "^[[:space:]]*" dep ":[[:space:]]*$" {
      found=1
      next
    }
    in_dep && $0 !~ /^      / {
      in_dep=0
    }
    END { exit(found ? 0 : 1) }
  ' docker-compose.yml; then
    print_info "$dependency dependency already present in $service service."
    return 0
  fi

  local awk_script_tmp
  awk_script_tmp=$(mktemp)
  cat > "$awk_script_tmp" << 'AWK_EOF'
function print_dep_entry(style, dep, cond) {
  if (style == "list") {
    print "      - " dep
  } else {
    print "      " dep ":"
    if (cond != "") {
      print "        condition: " cond
    }
  }
}

function print_dep_block(style, dep, cond) {
  print "    depends_on:"
  if (style == "list") {
    print "      - " dep
  } else {
    print_dep_entry("map", dep, cond)
  }
}

{
  lines[NR] = $0
}

END {
  for (i = 1; i <= NR; i++) {
    if (lines[i] ~ "^  " srv ":[[:space:]]*$") {
      in_target = 1
    } else if (in_target && lines[i] ~ /^  [A-Za-z0-9_-]+:[[:space:]]*$/ && lines[i] !~ "^  " srv ":[[:space:]]*$") {
      in_target = 0
    } else if (in_target) {
      if (lines[i] ~ /^    depends_on:[[:space:]]*$/) {
        has_depends_on = 1
        in_dep = 1
      } else if (in_dep && lines[i] ~ /^      - /) {
        if (dep_style == "") {
          dep_style = "list"
        }
      } else if (in_dep && lines[i] ~ /^      [A-Za-z0-9_-]+:[[:space:]]*$/) {
        if (dep_style == "") {
          dep_style = "map"
        }
      } else if (in_dep && lines[i] !~ /^      /) {
        in_dep = 0
      }
    }
  }

  if (dep_style == "") {
    dep_style = (cond != "" ? "map" : "list")
  }

  in_svc = 0
  in_dep = 0
  added = 0

  for (i = 1; i <= NR; i++) {
    line = lines[i]

    if (line ~ "^  " srv ":[[:space:]]*$") {
      in_svc = 1
      print line
      continue
    }

    if (in_svc && line ~ /^  [A-Za-z0-9_-]+:[[:space:]]*$/ && line !~ "^  " srv ":[[:space:]]*$") {
      if (in_dep && !added) {
        print_dep_entry(dep_style, dep, cond)
        added = 1
        in_dep = 0
      } else if (!has_depends_on && !added) {
        print_dep_block(dep_style, dep, cond)
        added = 1
      }
      in_svc = 0
      print line
      continue
    }

    if (in_svc && line ~ /^    depends_on:[[:space:]]*$/) {
      in_dep = 1
      print line
      continue
    }

    if (in_svc && in_dep && line !~ /^      /) {
      if (!added) {
        print_dep_entry(dep_style, dep, cond)
        added = 1
      }
      in_dep = 0
      print line
      continue
    }

    if (in_svc && !has_depends_on && !added && line ~ /^    [A-Za-z0-9_-]+:/) {
      print_dep_block(dep_style, dep, cond)
      added = 1
      print line
      continue
    }

    print line
  }

  if (in_dep && !added) {
    print_dep_entry(dep_style, dep, cond)
  } else if (in_svc && !has_depends_on && !added) {
    print_dep_block(dep_style, dep, cond)
  }
}
AWK_EOF

  awk -v srv="$service" -v dep="$dependency" -v cond="$condition" -f "$awk_script_tmp" docker-compose.yml > tmp.yml &&
    mv tmp.yml docker-compose.yml
  rm -f "$awk_script_tmp"

  print_status "Added $dependency dependency to $service service"
}

wait_for_rustfs_ready() {
  print_info "Waiting for RustFS to be ready..."
  local max_attempts=30
  local attempt=1

  while [[ $attempt -le $max_attempts ]]; do
    if docker run --rm $(compose_network_flag) --entrypoint /bin/sh "$MC_IMAGE" -lc \
      "mc alias set rustfs http://rustfs:9000 '$rustfs_admin_user' '$rustfs_admin_password' >/dev/null 2>&1 && mc admin info rustfs >/dev/null 2>&1"; then
      print_status "RustFS is ready!"
      return 0
    fi
    if [[ $attempt -eq $max_attempts ]]; then
      print_error "RustFS did not become ready within the expected time."
      return 1
    fi
    sleep 5
    ((attempt++))
  done
}

ensure_bucket_exists() {
  print_info "Ensuring bucket '$rustfs_bucket_name' exists..."
  docker run --rm $(compose_network_flag) \
    -e RUSTFS_ADMIN_USER="$rustfs_admin_user" \
    -e RUSTFS_ADMIN_PASSWORD="$rustfs_admin_password" \
    -e RUSTFS_BUCKET_NAME="$rustfs_bucket_name" \
    --entrypoint /bin/sh "$MC_IMAGE" -lc '
      mc alias set rustfs http://rustfs:9000 "$RUSTFS_ADMIN_USER" "$RUSTFS_ADMIN_PASSWORD" >/dev/null 2>&1
      mc mb rustfs/"$RUSTFS_BUCKET_NAME" --ignore-existing
    '
}

ensure_service_user_and_policy() {
  print_info "Ensuring RustFS service user and policy exist..."
  docker run --rm $(compose_network_flag) \
    -e RUSTFS_ADMIN_USER="$rustfs_admin_user" \
    -e RUSTFS_ADMIN_PASSWORD="$rustfs_admin_password" \
    -e RUSTFS_SERVICE_USER="$rustfs_service_user" \
    -e RUSTFS_SERVICE_PASSWORD="$rustfs_service_password" \
    -e RUSTFS_BUCKET_NAME="$rustfs_bucket_name" \
    -e RUSTFS_POLICY_NAME="$rustfs_policy_name" \
    --entrypoint /bin/sh "$MC_IMAGE" -lc '
      set -e
      mc alias set rustfs http://rustfs:9000 "$RUSTFS_ADMIN_USER" "$RUSTFS_ADMIN_PASSWORD" >/dev/null 2>&1
      if ! mc admin policy info rustfs "$RUSTFS_POLICY_NAME" >/dev/null 2>&1; then
        cat > /tmp/formbricks-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"], "Resource": ["arn:aws:s3:::$RUSTFS_BUCKET_NAME/*"] },
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": ["arn:aws:s3:::$RUSTFS_BUCKET_NAME"] }
  ]
}
EOF
        mc admin policy create rustfs "$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json >/dev/null 2>&1 || mc admin policy add rustfs "$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json >/dev/null 2>&1
      fi
      if ! mc admin user info rustfs "$RUSTFS_SERVICE_USER" >/dev/null 2>&1; then
        mc admin user add rustfs "$RUSTFS_SERVICE_USER" "$RUSTFS_SERVICE_PASSWORD" >/dev/null 2>&1
      fi
      mc admin policy attach rustfs "$RUSTFS_POLICY_NAME" --user "$RUSTFS_SERVICE_USER" >/dev/null 2>&1
    '
}

wait_for_service_up() {
  local service_name="$1"
  local max_attempts=30
  local attempt=1

  while [[ $attempt -le $max_attempts ]]; do
    if [[ -n "$(docker compose ps --status running -q "$service_name" 2>/dev/null)" ]]; then
      print_status "$service_name is running."
      return 0
    fi
    if [[ $attempt -eq $max_attempts ]]; then
      print_error "$service_name did not become ready within the expected time."
      return 1
    fi
    sleep 5
    ((attempt++))
  done
}

collect_upload_sources_post_start() {
  declare -A seen
  local out=()
  local env_path
  env_path=$(read_compose_value "UPLOADS_DIR")
  local container_present=0

  local awk_tmp
  awk_tmp=$(mktemp)
  cat > "$awk_tmp" <<'AWK_EOF'
      /^  formbricks:/ { in_svc=1; next }
      /^  [A-Za-z0-9_-]+:/ && !/^  formbricks:/ { in_svc=0 }
      in_svc && /^    volumes:/ { in_vol=1; next }
      in_svc && /^    [A-Za-z0-9_-]+:/ { if(in_vol) in_vol=0 }
      in_vol {
        if ($0 ~ /^[[:space:]]*-[[:space:]]*type:/){ tp=$0; sub(/.*type:[[:space:]]*/, "", tp); src=""; tgt="" }
        else if ($0 ~ /source:/){ line=$0; sub(/^[^:]*:[[:space:]]*/, "", line); src=line }
        else if ($0 ~ /target:/){ line=$0; sub(/^[^:]*:[[:space:]]*/, "", line); tgt=line; if (tp!="" && tgt!="") printf "%s|%s|%s\n", tp, src, tgt }
      }
AWK_EOF
  local entries
  entries=$(docker compose config 2>/dev/null | awk -f "$awk_tmp")
  rm -f "$awk_tmp"

  while IFS= read -r e; do
    [[ -z "$e" ]] && continue
    local tp src tgt rest
    tp="${e%%|*}"
    rest="${e#*|}"
    src="${rest%%|*}"
    tgt="${rest##*|}"

    if [[ "$tp" == "bind" && "$tgt" == *"/uploads"* ]]; then
      if [[ -z "${seen[$src]}" ]]; then
        out+=("$src")
        seen[$src]=1
      fi
    fi

    if [[ "$tp" == "volume" && "$src" == "uploads" ]]; then
      local key="container:$tgt"
      if [[ -z "${seen[$key]}" ]]; then
        out+=("$key")
        seen[$key]=1
      fi
      container_present=1
    fi
  done <<< "$entries"

  if [[ -n "$env_path" && "$env_path" =~ ^/ ]]; then
    local key="container:$env_path"
    if [[ -z "${seen[$key]}" ]]; then
      out+=("$key")
      seen[$key]=1
    fi
    container_present=1
  elif [[ -n "$env_path" && -d "$env_path" && -z "${seen[$env_path]}" ]]; then
    out+=("$env_path")
    seen[$env_path]=1
  elif [[ -n "$env_path" && -d "./$env_path" && -z "${seen[./$env_path]}" ]]; then
    out+=("./$env_path")
    seen["./$env_path"]=1
  fi

  if [[ $container_present -eq 0 ]]; then
    local legacy="container:/home/nextjs/apps/web/uploads"
    if [[ -z "${seen[$legacy]}" ]]; then
      out+=("$legacy")
      seen[$legacy]=1
    fi
  fi

  if [[ -d "./apps/web/uploads" && -z "${seen[./apps/web/uploads]}" ]]; then
    out+=("./apps/web/uploads")
    seen[./apps/web/uploads]=1
  fi

  if [[ -d "./uploads" && -z "${seen[./uploads]}" ]]; then
    out+=("./uploads")
    seen[./uploads]=1
  fi

  for s in "${out[@]}"; do
    echo "$s"
  done
}

preview_upload_sources() {
  local sources="$1"
  echo ""
  echo "📋 Migration sources preview:"
  while IFS= read -r src; do
    [[ -z "$src" ]] && continue
    if [[ "$src" == container:* ]]; then
      local p="${src#container:}"
      local cnt
      cnt=$(docker compose exec -T formbricks sh -lc 'find '"$p"' -type f 2>/dev/null | wc -l' || echo 0)
      echo "  - $src → $cnt files"
    else
      local cnt
      cnt=$(find "$src" -type f 2>/dev/null | wc -l || echo 0)
      echo "  - $src (host) → $cnt files"
    fi
  done <<< "$sources"
}

migrate_container_files_to_rustfs() {
  local container_path="$1"
  local file_count
  local formbricks_cid

  if ! docker compose exec -T formbricks test -d "$container_path" 2>/dev/null; then
    print_warning "Container path not found, skipping: $container_path"
    return 0
  fi

  file_count=$(docker compose exec -T formbricks find "$container_path" -type f 2>/dev/null | wc -l)
  if [[ $file_count -eq 0 ]]; then
    print_warning "No files found in $container_path to migrate."
    return 0
  fi

  formbricks_cid=$(docker compose ps -q formbricks)

  docker run --rm $(compose_network_flag) \
    --volumes-from "$formbricks_cid" \
    -e RUSTFS_ADMIN_USER="$rustfs_admin_user" \
    -e RUSTFS_ADMIN_PASSWORD="$rustfs_admin_password" \
    -e RUSTFS_BUCKET_NAME="$rustfs_bucket_name" \
    --entrypoint /bin/sh "$MC_IMAGE" -lc '
      mc alias set rustfs http://rustfs:9000 "$RUSTFS_ADMIN_USER" "$RUSTFS_ADMIN_PASSWORD"
      mc mirror --overwrite --preserve '"$container_path"' "rustfs/$RUSTFS_BUCKET_NAME"
    '

  print_status "Migrated $file_count files from $container_path"
}

migrate_host_files_to_rustfs() {
  local uploads_dir="$1"
  local file_count
  local host_src="$uploads_dir"

  if [[ ! -d "$uploads_dir" ]]; then
    print_warning "Host path not found, skipping: $uploads_dir"
    return 0
  fi

  file_count=$(find "$uploads_dir" -type f 2>/dev/null | wc -l)
  if [[ $file_count -eq 0 ]]; then
    print_warning "No files found in $uploads_dir to migrate."
    return 0
  fi

  if [[ "$host_src" != /* ]]; then
    host_src="$PWD/$host_src"
  fi

  docker run --rm $(compose_network_flag) \
    -v "$host_src:/source:ro" \
    -e RUSTFS_ADMIN_USER="$rustfs_admin_user" \
    -e RUSTFS_ADMIN_PASSWORD="$rustfs_admin_password" \
    -e RUSTFS_BUCKET_NAME="$rustfs_bucket_name" \
    --entrypoint /bin/sh "$MC_IMAGE" -lc '
      mc alias set rustfs http://rustfs:9000 "$RUSTFS_ADMIN_USER" "$RUSTFS_ADMIN_PASSWORD"
      mc mirror --overwrite --preserve /source "rustfs/$RUSTFS_BUCKET_NAME"
    '

  print_status "Migrated $file_count files from $uploads_dir"
}

cleanup_uploads_from_compose() {
  print_info "Cleaning docker-compose.yml uploads configuration..."

  if sed --version >/dev/null 2>&1; then
    sed -i 's/^\([[:space:]]*\)UPLOADS_DIR:[[:space:]].*/\1# UPLOADS_DIR:/' docker-compose.yml || true
  else
    sed -i '' 's/^\([[:space:]]*\)UPLOADS_DIR:[[:space:]].*/\1# UPLOADS_DIR:/' docker-compose.yml || true
  fi

  awk '
    BEGIN{in_svc=0; in_vol=0}
    /^  formbricks:/ {in_svc=1}
    /^  [A-Za-z0-9_-]+:/ && !/^  formbricks:/ {in_svc=0}
    {line=$0}
    in_svc && /^    volumes:/ {in_vol=1; print; next}
    in_svc && /^    [A-Za-z0-9_-]+:/ {if(in_vol) in_vol=0}
    in_vol {
      if (line ~ /^[[:space:]]*-[[:space:]]*uploads:/) next
      if (line ~ /^[[:space:]]*-[[:space:]].*\/uploads\/?[[:space:]]*$/) next
      print
      next
    }
    {print}
  ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

  awk '
    BEGIN{in_vol=0}
    /^volumes:[[:space:]]*$/ {print; in_vol=1; next}
    in_vol && /^  uploads:[[:space:]]*$/ {skip=1; next}
    in_vol && skip && /^[[:space:]]{4}[A-Za-z0-9_-]+:/ {next}
    in_vol && skip && /^  [A-Za-z0-9_-]+:/ {skip=0}
    { if (!skip) print }
  ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

  print_status "Removed legacy local uploads configuration from docker-compose.yml"
}

migrate_to_rustfs() {
  echo "🦀 Formbricks RustFS Migration"
  echo "=============================="
  echo ""
  print_info "This helper provisions bundled RustFS and migrates legacy local uploads."
  print_info "MinIO-backed installs are intentionally skipped."
  echo ""

  check_formbricks_directory
  backup_docker_compose
  external_s3_guard

  local main_domain
  local https_setup
  local files_domain

  main_domain=$(get_main_domain)
  https_setup=$(detect_https_setup)

  if [[ -z "$main_domain" ]]; then
    print_error "Could not detect WEBAPP_URL from docker-compose.yml"
    exit 1
  fi

  generate_rustfs_credentials

  if has_service rustfs; then
    files_domain=$(echo "$rustfs_existing_endpoint" | sed -E 's#^https?://##')
    if [[ -z "$files_domain" ]]; then
      files_domain="files.$main_domain"
    fi
    print_info "Detected existing RustFS configuration for $files_domain"
  else
    print_warning "RustFS requires a dedicated files subdomain."
    print_info "Make sure files.$main_domain points to the same server as your Formbricks instance."
    echo -n "Do you want to continue? [Y/n]: "
    read -r continue_setup
    continue_setup=$(echo "$continue_setup" | tr '[:upper:]' '[:lower:]')
    if [[ -n "$continue_setup" && "$continue_setup" != "y" ]]; then
      print_info "Migration cancelled."
      exit 0
    fi

    local default_files_domain="files.$main_domain"
    echo -n "Enter the files subdomain to use for RustFS (e.g., $default_files_domain): "
    read -r files_domain
    if [[ -z "$files_domain" ]]; then
      files_domain="$default_files_domain"
    fi

    add_rustfs_environment_variables "$files_domain" "$https_setup"
    add_rustfs_services "$files_domain" "$main_domain" "$https_setup"
    add_rustfs_volume
  fi

  if has_service rustfs-init; then
    ensure_service_dependency "formbricks" "rustfs-init" "service_completed_successfully"
  else
    print_info "No rustfs-init service detected; leaving formbricks startup order unchanged."
  fi
  ensure_service_dependency "traefik" "rustfs" "service_started" "true"

  echo ""
  echo -n "Restart Docker Compose now to provision RustFS and continue the migration? [Y/n]: "
  read -r restart_confirm
  restart_confirm=$(echo "$restart_confirm" | tr '[:upper:]' '[:lower:]')
  if [[ -n "$restart_confirm" && "$restart_confirm" != "y" ]]; then
    print_warning "Migration cancelled before any file copy."
    print_info "Run 'docker compose up -d --remove-orphans' later, then rerun this script."
    exit 0
  fi

  docker compose up -d --remove-orphans

  wait_for_service_up formbricks
  wait_for_rustfs_ready
  ensure_service_user_and_policy
  ensure_bucket_exists

  local sources
  sources=$(collect_upload_sources_post_start)
  preview_upload_sources "$sources"

  if [[ -z "$sources" ]]; then
    echo -n "No upload sources were detected automatically. Enter a path (container:/path or ./path), or press Enter to skip: "
    read -r manual_src
    manual_src=$(echo "$manual_src" | xargs)
    if [[ -n "$manual_src" ]]; then
      sources="$manual_src"
    fi
  fi

  if [[ -z "$sources" ]]; then
    print_warning "No uploads directory was detected."
    print_info "Skipping cleanup so the existing local uploads configuration remains intact."
    print_info "If your uploads live in a non-standard path, rerun this helper and provide it manually."
    print_status "RustFS is configured. Legacy local uploads settings were left unchanged."
    exit 0
  else
    echo -n "Proceed with the migration from the sources above? [Y/n]: "
    read -r do_migration
    do_migration=$(echo "$do_migration" | tr '[:upper:]' '[:lower:]')
    if [[ -n "$do_migration" && "$do_migration" != "y" ]]; then
      print_warning "Skipped file migration at your request."
      exit 0
    fi

    local migration_failed=0
    while IFS= read -r src; do
      [[ -z "$src" ]] && continue
      if [[ "$src" == container:* ]]; then
        migrate_container_files_to_rustfs "${src#container:}" || migration_failed=1
      else
        migrate_host_files_to_rustfs "$src" || migration_failed=1
      fi
    done <<< "$sources"

    if [[ $migration_failed -eq 0 ]]; then
      cleanup_uploads_from_compose
      print_status "Local uploads have been migrated to RustFS."
    else
      print_error "Migration failed before cleanup."
      print_info "Legacy upload paths were left untouched so you can retry safely."
      exit 1
    fi
  fi

  echo ""
  print_status "RustFS migration complete."
  print_info "Files domain: $files_domain"
  print_info "S3 Bucket: $rustfs_bucket_name"
  print_info "Generated RustFS credentials were written to .env with 600 permissions."
  print_info "Cleanup note: keep rustfs-init if you want idempotent bootstrap on future restarts."
}

migrate_to_rustfs "$@"
