#!/bin/env bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to cleanup sensitive output from terminal and history (best effort)
cleanup_sensitive_output() {
    echo ""
    print_warning "⚠️  SECURITY NOTICE: Sensitive credentials were displayed above."
    print_info "Please copy and securely save these credentials before proceeding."
    echo ""
    if [ -t 0 ] && [ -t 1 ]; then
        echo -n "After you have safely saved the credentials, press Enter to clear the terminal and command history: "
        read -r
        # Clear the terminal screen and scrollback buffer (best effort across terminals)
        clear 2>/dev/null || true
        printf '\033[3J' 2>/dev/null || true
        # Clear bash history for current session (no-op in non-interactive shells)
        history -c 2>/dev/null || true
        history -w 2>/dev/null || true
        print_status "✅ Terminal and command history cleared for security."
        print_info "The credentials are no longer visible in this terminal session."
    else
        print_info "Non-interactive session detected. Skipping terminal/history cleanup."
    fi
    print_warning "Remember: The credentials are still in your docker-compose.yml file - keep it secure!"
    echo ""
}

# Mode flags (set interactively)
FORCE_RECONFIGURE=false
MIGRATE_ONLY=false
REGENERATE_CREDS=false

# Quietly detect uploads path inside the running formbricks container (returns only the path or empty)
get_container_uploads_path_quiet() {
    # Prefer explicit container target from compose, else UPLOADS_DIR (absolute), else legacy
    local target
    target=$(get_uploads_container_target)
    local env_path
    env_path=$(read_compose_value "UPLOADS_DIR")
    local path
    if [[ -n "$target" ]]; then
      path="$target"
    elif [[ -n "$env_path" && "$env_path" =~ ^/ ]]; then
      path="$env_path"
    else
      path="/home/nextjs/apps/web/uploads"
    fi
    local max_attempts=12
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if docker compose ps -q formbricks >/dev/null 2>&1; then
            if docker compose exec -T formbricks test -d "$path" 2>/dev/null; then
                echo "container:$path"
                return 0
            fi
        fi
        sleep 2
        ((attempt++))
    done
    echo ""
}

# Collect multiple candidate upload sources (newline-separated), de-duplicated
collect_upload_sources() {
    declare -A seen
    local out=()

    local env_path
    env_path=$(read_compose_value "UPLOADS_DIR")
    local mount_target
    mount_target=$(get_uploads_container_target)

    # 1) container mount target (from compose)
    if [[ -n "$mount_target" ]]; then
        local key="container:$mount_target"
        if [[ -z "${seen[$key]}" ]]; then out+=("$key"); seen[$key]=1; fi
    fi

    # 2) container UPLOADS_DIR (absolute)
    if [[ -n "$env_path" && "$env_path" =~ ^/ ]]; then
        local key="container:$env_path"
        if [[ -z "${seen[$key]}" ]]; then out+=("$key"); seen[$key]=1; fi
    fi

    # 3) legacy container path
    local legacy="container:/home/nextjs/apps/web/uploads"
    if [[ -z "${seen[$legacy]}" ]]; then out+=("$legacy"); seen[$legacy]=1; fi

    # 4) host UPLOADS_DIR if exists
    if [[ -n "$env_path" && ! "$env_path" =~ ^/ ]]; then
        if [[ -d "$env_path" ]]; then
            if [[ -z "${seen[$env_path]}" ]]; then out+=("$env_path"); seen[$env_path]=1; fi
        elif [[ -d "./$env_path" ]]; then
            local hp="./$env_path"
            if [[ -z "${seen[$hp]}" ]]; then out+=("$hp"); seen[$hp]=1; fi
        fi
    fi

    # 5) fallback host paths
    if [[ -d "./apps/web/uploads" && -z "${seen[./apps/web/uploads]}" ]]; then out+=("./apps/web/uploads"); seen[./apps/web/uploads]=1; fi
    if [[ -d "./uploads" && -z "${seen[./uploads]}" ]]; then out+=("./uploads"); seen[./uploads]=1; fi

    for s in "${out[@]}"; do echo "$s"; done
}

# Collect upload sources from rendered compose (post-start only)
collect_upload_sources_post_start() {
    declare -A seen
    local out=()
    local container_present=0

    local env_path
    env_path=$(read_compose_value "UPLOADS_DIR")

    # Parse rendered compose volumes for formbricks service (write awk program to a tmp file to avoid any escape/ANSI issues)
    local __awk_tmp__
    __awk_tmp__=$(mktemp)
    cat > "$__awk_tmp__" <<'AWK_EOF'
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
    entries=$(docker compose config 2>/dev/null | awk -f "$__awk_tmp__")
    rm -f "$__awk_tmp__"

    # From entries, add bind mounts to uploads (host path) and the uploads named volume target (container path)
    while IFS= read -r e; do
        [[ -z "$e" ]] && continue
        local tp src tgt rest
        tp="${e%%|*}"; rest="${e#*|}"; src="${rest%%|*}"; tgt="${rest##*|}"
        if [[ "$tp" == "bind" && "$tgt" == *"/uploads"* ]]; then
            # docker compose config resolves ./ to absolute paths
            if [[ -z "${seen[$src]}" ]]; then out+=("$src"); seen[$src]=1; fi
        fi
        if [[ "$tp" == "volume" && "$src" == "uploads" ]]; then
            local key="container:$tgt"
            if [[ -z "${seen[$key]}" ]]; then out+=("$key"); seen[$key]=1; fi
            container_present=1
        fi
    done <<< "$entries"

    # Also include absolute UPLOADS_DIR as container path
    if [[ -n "$env_path" && "$env_path" =~ ^/ ]]; then
        local key="container:$env_path"
        if [[ -z "${seen[$key]}" ]]; then out+=("$key"); seen[$key]=1; fi
        container_present=1
    fi

    # Legacy fallback only if no container source was detected
    if [[ $container_present -eq 0 ]]; then
        local legacy="container:/home/nextjs/apps/web/uploads"
        if [[ -z "${seen[$legacy]}" ]]; then out+=("$legacy"); seen[$legacy]=1; fi
    fi

    for s in "${out[@]}"; do echo "$s"; done
}

# Preview counts for each source
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

# Migrate a generic source path (container:* or host)
migrate_from_source() {
    local src="$1"
    if [[ "$src" == container:* ]]; then
        local p="${src#container:}"
        if docker compose exec -T formbricks test -d "$p" 2>/dev/null; then
            migrate_container_files_to_minio "$p"
        else
            print_warning "Container path not found, skipping: $p"
        fi
    else
        if [[ -d "$src" ]]; then
            migrate_files_to_minio "$src"
        else
            print_warning "Host path not found, skipping: $src"
        fi
    fi
}

# Helper: read a simple KEY: value (quoted or unquoted) from docker-compose.yml
read_compose_value() {
    local key="$1"
    # Prefer quoted value
    local val
    val=$(sed -n "s/^[[:space:]]*$key:[[:space:]]*\"\(.*\)\"[[:space:]]*$/\1/p" docker-compose.yml | head -n 1)
    if [[ -z "$val" ]]; then
        val=$(sed -n "s/^[[:space:]]*$key:[[:space:]]*\([^#][^[:space:]]*\)[[:space:]]*$/\1/p" docker-compose.yml | head -n 1)
    fi
    echo "$val"
}

# Read container mount target for the named volume `uploads` under the formbricks service (e.g., /home/nextjs/apps/web/uploads)
get_uploads_container_target() {
    docker compose config 2>/dev/null | awk '
      /^  formbricks:/ { in_svc=1; next }
      /^  [A-Za-z0-9_-]+:/ && !/^  formbricks:/ { in_svc=0 }
      in_svc && /^    volumes:/ { in_vol=1; next }
      in_svc && /^    [A-Za-z0-9_-]+:/ { if(in_vol) in_vol=0 }
      in_vol {
        if ($0 ~ /source:[[:space:]]*uploads[[:space:]]*$/) { seen_src=1 }
        else if (seen_src && $0 ~ /target:[[:space:]]*/) {
          sub(/^[^:]*:[[:space:]]*/, "", $0); print; exit
        }
        # reset seen_src when a new entry starts
        if ($0 ~ /^[[:space:]]*-[[:space:]]*type:/ && seen_src && !found) { seen_src=0 }
      }
    '
}

# Idempotency helpers
has_service() {
    grep -q "^  $1:[[:space:]]*$" docker-compose.yml
}

add_or_replace_env_var() {
    local key="$1"; local value="$2"
    if grep -q "^[[:space:]]*$key:" docker-compose.yml; then
        # Replace existing uncommented key
        if sed --version >/dev/null 2>&1; then sed -i "s|^\([[:space:]]*$key:\).*|\1 \"$value\"|" docker-compose.yml; else sed -i '' "s|^\([[:space:]]*$key:\).*|\1 \"$value\"|" docker-compose.yml; fi
    elif grep -q "^[[:space:]]*#[[:space:]]*$key:" docker-compose.yml; then
        # Uncomment placeholder and set
        if sed --version >/dev/null 2>&1; then sed -i "s|^[[:space:]]*#[[:space:]]*$key:.*|    $key: \"$value\"|" docker-compose.yml; else sed -i '' "s|^[[:space:]]*#[[:space:]]*$key:.*|    $key: \"$value\"|" docker-compose.yml; fi
    else
        # Append into STORAGE section before OAUTH header if present
        awk -v insert_key="$key" -v insert_val="$value" '
          BEGIN{printed=0}
          /################################################### OPTIONAL \(STORAGE\) ###################################################/ {print; in=1; next}
          in && /############################################# OPTIONAL \(OAUTH CONFIGURATION\) #############################################/ && !printed { print "    " insert_key ": \"" insert_val "\""; printed=1; print; in=0; next }
          { print }
          END { if(in && !printed) print "    " insert_key ": \"" insert_val "\"" }
        ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
    fi
}

# Function to check if we're in the correct directory
check_formbricks_directory() {
    if [[ ! -f "docker-compose.yml" ]]; then
        print_error "docker-compose.yml not found in current directory!"
        print_info "Please run this script from your Formbricks installation directory (usually ./formbricks/)"
        exit 1
    fi
    
    if ! grep -q "formbricks" docker-compose.yml; then
        print_error "This doesn't appear to be a Formbricks docker-compose.yml file!"
        exit 1
    fi
}

# Function to backup existing docker-compose.yml
backup_docker_compose() {
    local backup_file="docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)"
    cp docker-compose.yml "$backup_file"
    print_status "Backed up docker-compose.yml to $backup_file"
}

# Function to check if MinIO is already configured
check_minio_configured() {
    if grep -q "minio:" docker-compose.yml; then
        # Respect explicit CLI flags first
        if [[ "$FORCE_RECONFIGURE" == true ]]; then
            print_info "MinIO already configured; proceeding with reconfiguration (flag)."
            return 0
        fi
        if [[ "$MIGRATE_ONLY" == true ]]; then
            print_info "MinIO already configured; proceeding with files migration only (flag)."
            return 0
        fi

        print_warning "MinIO appears to already be configured in docker-compose.yml"
        echo -n "Reconfigure MinIO and rerun the full migration? [y/N]: "
        read ans
        ans=$(echo "$ans" | tr '[:upper:]' '[:lower:]')
        if [[ "$ans" == "y" ]]; then
            FORCE_RECONFIGURE=true
            REGENERATE_CREDS=true
            return 0
        fi

        echo -n "Run files migration only (skip MinIO reconfiguration)? [Y/n]: "
        read only_mig
        only_mig=$(echo "$only_mig" | tr '[:upper:]' '[:lower:]')
        if [[ -z "$only_mig" || "$only_mig" == "y" ]]; then
            MIGRATE_ONLY=true
            return 0
        fi

        print_info "Operation cancelled by user."
        exit 0
    fi
}

# Remove existing minio and minio-init service blocks from docker-compose.yml
remove_minio_services() {
    awk '
      BEGIN{in_svc=0; skip=0}
      /^services:[[:space:]]*$/ {print; next}
      /^  minio:/ {skip=1; next}
      /^  minio-init:/ {skip=1; next}
      /^  [A-Za-z0-9_-]+:/ { if(skip){ skip=0 } }
      { if(!skip) print }
    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
    print_status "Removed existing MinIO services from docker-compose.yml"
}

# Function to generate MinIO credentials
generate_minio_credentials() {
    # Reuse existing credentials if present (idempotent), otherwise generate new
    local existing_s3_access existing_s3_secret existing_bucket existing_root_user existing_root_password existing_service_user existing_service_password
    existing_s3_access=$(read_compose_value "S3_ACCESS_KEY")
    existing_s3_secret=$(read_compose_value "S3_SECRET_KEY")
    existing_bucket=$(read_compose_value "S3_BUCKET_NAME")
    existing_root_user=$(read_compose_value "MINIO_ROOT_USER")
    existing_root_password=$(read_compose_value "MINIO_ROOT_PASSWORD")
    existing_service_user=$(read_compose_value "MINIO_SERVICE_USER")
    existing_service_password=$(read_compose_value "MINIO_SERVICE_PASSWORD")

    # Service account (used by Formbricks) — prefer existing S3_* first, then existing MINIO_SERVICE_*, else generate
    if [[ "$REGENERATE_CREDS" == true ]]; then
        minio_service_user="formbricks-service-$(openssl rand -hex 4)"
        minio_service_password=$(openssl rand -base64 20)
    elif [[ -n "$existing_s3_access" && -n "$existing_s3_secret" ]]; then
        minio_service_user="$existing_s3_access"
        minio_service_password="$existing_s3_secret"
    elif [[ -n "$existing_service_user" && -n "$existing_service_password" ]]; then
        minio_service_user="$existing_service_user"
        minio_service_password="$existing_service_password"
    else
        minio_service_user="formbricks-service-$(openssl rand -hex 4)"
        minio_service_password=$(openssl rand -base64 20)
    fi

    # Bucket — prefer existing S3 bucket name
    if [[ -n "$existing_bucket" ]]; then
        minio_bucket_name="$existing_bucket"
    else
        minio_bucket_name="formbricks-uploads"
    fi

    # Root credentials for MinIO server — prefer existing if present
    if [[ "$REGENERATE_CREDS" == true ]]; then
        minio_root_user="formbricks-$(openssl rand -hex 4)"
        minio_root_password=$(openssl rand -base64 20)
    elif [[ -n "$existing_root_user" && -n "$existing_root_password" ]]; then
        minio_root_user="$existing_root_user"
        minio_root_password="$existing_root_password"
    else
        minio_root_user="formbricks-$(openssl rand -hex 4)"
        minio_root_password=$(openssl rand -base64 20)
    fi

    # Shared policy across rotations for simplicity and no dangling policies
    minio_policy_name="formbricks-policy"
    if [[ "$REGENERATE_CREDS" == true ]]; then
        prev_service_user="${existing_s3_access:-$existing_service_user}"
    else
        prev_service_user=""
    fi
    
    if [[ "$MIGRATE_ONLY" != true || "$REGENERATE_CREDS" == true ]]; then
        print_status "Generated MinIO credentials"
        print_info "Root User: $minio_root_user"
        print_info "Service User: $minio_service_user"
        print_info "Bucket: $minio_bucket_name"
    fi
}

# Function to detect HTTPS setup
detect_https_setup() {
    if grep -q "websecure" docker-compose.yml || grep -q "certresolver" docker-compose.yml; then
        echo "y"
    else
        echo "n"
    fi
}

# Function to get main domain from docker-compose.yml
get_main_domain() {
    local domain=""
    if grep -q "WEBAPP_URL:" docker-compose.yml; then
        domain=$(grep "WEBAPP_URL:" docker-compose.yml | sed 's/.*WEBAPP_URL: *"\?\([^"]*\)"\?.*/\1/' | sed 's|https\?://||')
        echo "$domain"
    else
        echo ""
    fi
}

# Function to add S3 environment variables
add_s3_environment_variables() {
    local files_domain="$1"
    local https_setup="$2"
    
    # Determine S3 endpoint URL based on HTTPS setup
    local s3_endpoint_url=""
    if [[ "$https_setup" == "y" ]]; then
        s3_endpoint_url="https://$files_domain"
    else
        s3_endpoint_url="http://$files_domain"
    fi
    
    # Idempotently set/update S3 environment variables
    add_or_replace_env_var "S3_ACCESS_KEY" "$minio_service_user"
    add_or_replace_env_var "S3_SECRET_KEY" "$minio_service_password"
    add_or_replace_env_var "S3_REGION" "us-east-1"
    add_or_replace_env_var "S3_BUCKET_NAME" "$minio_bucket_name"
    add_or_replace_env_var "S3_ENDPOINT_URL" "$s3_endpoint_url"
    add_or_replace_env_var "S3_FORCE_PATH_STYLE" "1"
    
    print_status "S3 environment variables ensured in docker-compose.yml"
}

# Function to add MinIO service to docker-compose.yml
add_minio_service() {
    local files_domain="$1"
    local main_domain="$2"
    local https_setup="$3"
    
    # Skip injecting if services already exist
    if has_service minio && has_service minio-init; then
        print_info "MinIO services already present. Skipping service injection."
        return 0
    fi
    
    # Create MinIO service configuration
    local minio_service_config=""
    
    if [[ "$https_setup" == "y" ]]; then
      traefik_entrypoints="websecure"; cors_origin="https://$main_domain"; tls_block=$'      - "traefik.http.routers.minio-s3.tls=true"\n      - "traefik.http.routers.minio-s3.tls.certresolver=default"'
    else
      traefik_entrypoints="web"; cors_origin="http://$main_domain"; tls_block=""
    fi

    minio_service_config="
  minio:
    restart: always
    image: minio/minio@sha256:13582eff79c6605a2d315bdd0e70164142ea7e98fc8411e9e10d089502a6d883
    command: server /data
    environment:
      MINIO_ROOT_USER: \"$minio_root_user\"
      MINIO_ROOT_PASSWORD: \"$minio_root_password\"
    volumes:
      - minio-data:/data
    labels:
      - \"traefik.enable=true\"
      - \"traefik.http.routers.minio-s3.rule=Host(\`$files_domain\`)\"
      - \"traefik.http.routers.minio-s3.entrypoints=$traefik_entrypoints\"
${tls_block}
      - \"traefik.http.routers.minio-s3.service=minio-s3\"
      - \"traefik.http.services.minio-s3.loadbalancer.server.port=9000\"
      - \"traefik.http.routers.minio-s3.middlewares=minio-cors,minio-ratelimit\"
      - \"traefik.http.middlewares.minio-cors.headers.accesscontrolallowmethods=GET,PUT,POST,DELETE,HEAD,OPTIONS\"
      - \"traefik.http.middlewares.minio-cors.headers.accesscontrolallowheaders=*\"
      - \"traefik.http.middlewares.minio-cors.headers.accesscontrolalloworiginlist=$cors_origin\"
      - \"traefik.http.middlewares.minio-cors.headers.accesscontrolmaxage=100\"
      - \"traefik.http.middlewares.minio-cors.headers.addvaryheader=true\"
      - \"traefik.http.middlewares.minio-ratelimit.ratelimit.average=100\"
      - \"traefik.http.middlewares.minio-ratelimit.ratelimit.burst=200\"

  minio-init:
    image: minio/mc@sha256:95b5f3f7969a5c5a9f3a700ba72d5c84172819e13385aaf916e237cf111ab868
    depends_on:
      - minio
    environment:
      MINIO_ROOT_USER: \"$minio_root_user\"
      MINIO_ROOT_PASSWORD: \"$minio_root_password\"
      MINIO_SERVICE_USER: \"$minio_service_user\"
      MINIO_SERVICE_PASSWORD: \"$minio_service_password\"
      MINIO_BUCKET_NAME: \"$minio_bucket_name\"
    entrypoint:
      - /bin/sh
      - -c
      - |
        echo '⏳ Waiting for MinIO to be ready...';
        attempts=0
        max_attempts=30
        until mc alias set minio http://minio:9000 "$minio_root_user" "$minio_root_password" >/dev/null 2>&1 \
          && mc ls minio >/dev/null 2>&1; do
          attempts=$((attempts + 1))
          if [ $attempts -ge $max_attempts ]; then
            printf '❌ Failed to connect to MinIO after %s attempts\n' "$max_attempts"
            exit 1
          fi
          printf '...still waiting attempt %s/%s\n' "$attempts" "$max_attempts"
          sleep 2
        done
        echo '🔗 MinIO reachable; alias configured.';
        
        echo '🪣 Creating bucket (idempotent)...';
        mc mb minio/$minio_bucket_name --ignore-existing;
        
        echo '📄 Creating JSON policy file...';
        cat > /tmp/formbricks-policy.json << 'POLICY_EOF'
        {
          \"Version\": \"2012-10-17\",
          \"Statement\": [
            {
              \"Effect\": \"Allow\",
              \"Action\": [\"s3:DeleteObject\", \"s3:GetObject\", \"s3:PutObject\"],
              \"Resource\": [\"arn:aws:s3:::$minio_bucket_name/*\"]
            },
            {
              \"Effect\": \"Allow\",
              \"Action\": [\"s3:ListBucket\"],
              \"Resource\": [\"arn:aws:s3:::$minio_bucket_name\"]
            }
          ]
        }
        POLICY_EOF
        
        echo '🔒 Creating policy (idempotent)...';
        if ! mc admin policy info minio $minio_policy_name >/dev/null 2>&1; then
          mc admin policy create minio $minio_policy_name /tmp/formbricks-policy.json || true;
          echo 'Policy created successfully.';
        else
          echo 'Policy already exists, skipping creation.';
        fi
        
        echo '👤 Creating service user (idempotent)...';
        if ! mc admin user info minio \"$minio_service_user\" >/dev/null 2>&1; then
          mc admin user add minio \"$minio_service_user\" \"$minio_service_password\";
          echo 'User created successfully.';
        else
          echo 'User already exists, skipping creation.';
        fi
        
        echo '🔗 Attaching policy to user (idempotent)...';
        mc admin policy attach minio $minio_policy_name --user \"$minio_service_user\" || echo 'Policy already attached or attachment failed (non-fatal).';
        # If creds were rotated, delete the previous service user (shared policy retained)
        if [ \"$REGENERATE_CREDS\" = true ] && [ -n \"$prev_service_user\" ] && [ \"$prev_service_user\" != \"$minio_service_user\" ]; then
          echo '🧹 Cleaning up previous service user...';
          mc admin user remove minio \"$prev_service_user\" || echo 'Previous user removal failed or not found (non-fatal).';
        fi
        
        echo '✅ MinIO setup complete!';
        exit 0;"
    
    # Write MinIO service to temporary file
    echo "$minio_service_config" > minio_service.tmp
    
    # Add MinIO service before the volumes section
    awk '
    {
        print
        if ($0 ~ /^services:$/ && !inserted) {
            while ((getline line < "minio_service.tmp") > 0) print line
            close("minio_service.tmp")
            inserted = 1
        }
    }
    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
    
    # Clean up temporary file
    rm -f minio_service.tmp
    
    print_status "Added MinIO service to docker-compose.yml"
}

# Function to add minio-init dependency to formbricks service
add_minio_dependency() {
    # Only add if not already present
    if ! awk '/formbricks:/,/depends_on:/{ if($0 ~ /minio-init/) found=1 } END{ exit(found) }' docker-compose.yml; then
        if sed --version >/dev/null 2>&1; then sed -i '/formbricks:/,/depends_on:/{/- postgres/a\
      - minio-init
}' docker-compose.yml; else sed -i '' '/formbricks:/,/depends_on:/{/- postgres/a\
      - minio-init
}' docker-compose.yml; fi
        print_status "Added minio-init dependency to formbricks service"
    else
        print_info "minio-init dependency already present."
    fi
}

# Function to update Traefik configuration to include MinIO dependency
update_traefik_config() {
    # Check if traefik service exists and add minio dependency
    if grep -q "traefik:" docker-compose.yml; then
        if ! awk '/traefik:/,/depends_on:/{ if($0 ~ /- minio$/) found=1 } END{ exit(found) }' docker-compose.yml; then
            if sed --version >/dev/null 2>&1; then sed -i '/traefik:/,/depends_on:/{/- formbricks/a\
      - minio
}' docker-compose.yml; else sed -i '' '/traefik:/,/depends_on:/{/- formbricks/a\
      - minio
}' docker-compose.yml; fi
            print_status "Updated Traefik configuration to include MinIO dependency"
        else
            print_info "Traefik already depends_on minio."
        fi
    fi
}

# Function to add minio-data volume
add_minio_volume() {
    # Ensure minio-data volume exists once
    if grep -q '^volumes:' docker-compose.yml; then
      # volumes block exists; check for minio-data inside it
      if awk '/^volumes:/{invol=1; next} invol && NF==0{invol=0} invol{ if($1=="minio-data:") found=1 } END{ exit(!found) }' docker-compose.yml; then
        print_info "minio-data volume already present."
      else
        awk '
          /^volumes:/ { print; invol=1; next }
          invol && /^[^[:space:]]/ { if(!added){ print "  minio-data:"; print "    driver: local"; added=1 } ; invol=0 }
          { print }
          END { if (invol && !added) { print "  minio-data:"; print "    driver: local" } }
        ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
        print_status "minio-data volume ensured"
      fi
    else
      # no volumes block; append one with minio-data only (non-destructive to services)
      {
        echo ""
        echo "volumes:"
        echo "  minio-data:"
        echo "    driver: local"
      } >> docker-compose.yml
      print_status "Added volumes section with minio-data"
    fi
}

# Function to check if MinIO is ready by probing the minio container
wait_for_minio_ready() {
    print_info "Waiting for MinIO to be ready..."
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        # Probe using mc from a one-off mc container to avoid relying on service state
        if docker run --rm --network "$(basename $(pwd))_default" --entrypoint /bin/sh minio/mc:latest -lc \
          "mc alias set minio http://minio:9000 '$minio_root_user' '$minio_root_password' >/dev/null 2>&1 && mc admin info minio >/dev/null 2>&1"; then
          print_status "MinIO is ready!"
          return 0
        fi
        if [[ $attempt -eq $max_attempts ]]; then
            print_error "MinIO did not become ready within expected time. Please check the logs."
            return 1
        fi
        print_info "Attempt $attempt/$max_attempts - waiting for MinIO..."
        sleep 5
        ((attempt++))
    done
}

# Ensure the target bucket exists (idempotent)
ensure_bucket_exists() {
    print_info "Ensuring bucket '$minio_bucket_name' exists..."
    docker run --rm \
        --network "$(basename $(pwd))_default" \
        -e MINIO_ROOT_USER="$minio_root_user" \
        -e MINIO_ROOT_PASSWORD="$minio_root_password" \
        -e MINIO_BUCKET_NAME="$minio_bucket_name" \
        --entrypoint /bin/sh \
        minio/mc:latest -lc '
            mc alias set minio http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1;
            mc mb minio/"$MINIO_BUCKET_NAME" --ignore-existing
        '
}

# Ensure service user and shared policy exist and are attached (idempotent)
ensure_service_user_and_policy() {
    print_info "Ensuring service user and policy exist..."
    docker run --rm \
        --network "$(basename $(pwd))_default" \
        -e MINIO_ROOT_USER="$minio_root_user" \
        -e MINIO_ROOT_PASSWORD="$minio_root_password" \
        -e MINIO_SERVICE_USER="$minio_service_user" \
        -e MINIO_SERVICE_PASSWORD="$minio_service_password" \
        -e MINIO_BUCKET_NAME="$minio_bucket_name" \
        --entrypoint /bin/sh minio/mc:latest -lc '
            mc alias set minio http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1;
            # Create shared policy if missing
            if ! mc admin policy info minio formbricks-policy >/dev/null 2>&1; then
                cat > /tmp/formbricks-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"], "Resource": ["arn:aws:s3:::$MINIO_BUCKET_NAME/*"] },
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": ["arn:aws:s3:::$MINIO_BUCKET_NAME"] }
  ]
}
EOF
                mc admin policy create minio formbricks-policy /tmp/formbricks-policy.json >/dev/null 2>&1 || true
            fi;
            # Create service user if missing
            if ! mc admin user info minio "$MINIO_SERVICE_USER" >/dev/null 2>&1; then
                mc admin user add minio "$MINIO_SERVICE_USER" "$MINIO_SERVICE_PASSWORD" >/dev/null 2>&1 || true
            fi;
            # Attach policy (idempotent)
            mc admin policy attach minio formbricks-policy --user "$MINIO_SERVICE_USER" >/dev/null 2>&1 || true
        '
}

# Function to migrate files from container storage to MinIO
migrate_container_files_to_minio() {
    local container_path="$1"
    
    print_info "Starting file migration from container path $container_path to MinIO..."
    
    # Wait for MinIO to be ready, then ensure user/policy (idempotent)
    wait_for_minio_ready || return 1
    ensure_service_user_and_policy
    ensure_bucket_exists || return 1
    
    # Count files to migrate
    local file_count=$(docker compose exec -T formbricks find "$container_path" -type f 2>/dev/null | wc -l)
    if [[ $file_count -eq 0 ]]; then
        print_warning "No files found in container path $container_path to migrate."
        return 0
    fi
    
    print_info "Found $file_count files to migrate from container"
    
    # Create a migration script inside the container
    print_info "Starting container-to-MinIO migration..."
    
    docker compose exec -T formbricks sh -c "
        echo '📁 Starting file migration from container to MinIO...';
        file_count=0;
        error_count=0;
        
        # Install mc (MinIO client) in the formbricks container temporarily
        curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /tmp/mc;
        chmod +x /tmp/mc;
        
        # Set up MinIO alias
        /tmp/mc alias set minio http://minio:9000 '$minio_root_user' '$minio_root_password';
        
        # Migrate files
        find '$container_path' -type f | while read file; do
            relative_path=\"\${file#$container_path/}\";
            echo \"Uploading: \$relative_path\";
            
            if /tmp/mc cp \"\$file\" \"minio/$minio_bucket_name/\$relative_path\"; then
                file_count=\$((file_count + 1));
                if [ \$((file_count % 10)) -eq 0 ]; then
                    echo \"✅ Migrated \$file_count files so far...\";
                fi
            else
                echo \"❌ Failed to upload: \$relative_path\";
                error_count=\$((error_count + 1));
            fi
        done;
        
        echo '📊 Migration Summary:';
        echo \"   Files processed: \$file_count\";
        echo \"   Errors: \$error_count\";
        
        # Clean up mc binary
        rm -f /tmp/mc;
        
        if [ \$error_count -eq 0 ]; then
            echo '✅ All files migrated successfully!';
            exit 0;
        else
            echo \"⚠️  Migration completed with \$error_count errors.\";
            exit 1;
        fi
    "
    
    if [[ $? -eq 0 ]]; then
        print_status "Container file migration completed successfully!"
        # Non-blocking suggestion for clearing container path
        print_info "Tip: To clear container uploads later, run: docker compose exec -T formbricks sh -lc 'rm -rf "$container_path"/*'"
    else
        print_error "Container file migration encountered errors. Please check the output above."
        return 1
    fi
}

# Function to migrate files from local storage to MinIO
migrate_files_to_minio() {
    local uploads_dir="$1"
    
    if [[ -z "$uploads_dir" ]]; then
        print_warning "No existing uploads directory found or directory is empty. Skipping file migration."
        return 0
    fi
    
    # Check if this is a container-based uploads directory
    if [[ "$uploads_dir" == container:* ]]; then
        local container_path="${uploads_dir#container:}"
        print_info "Detected container-based uploads at: $container_path"
        migrate_container_files_to_minio "$container_path"
        return $?
    elif [[ ! -d "$uploads_dir" ]]; then
        print_warning "Host uploads directory not found: $uploads_dir. Skipping file migration."
        return 0
    fi
    
    print_info "Starting file migration from $uploads_dir to MinIO..."
    
    # Wait for MinIO to be ready, then ensure user/policy (idempotent)
    wait_for_minio_ready || return 1
    ensure_service_user_and_policy
    ensure_bucket_exists || return 1
    
    # Count files to migrate
    local file_count=$(find "$uploads_dir" -type f 2>/dev/null | wc -l)
    if [[ $file_count -eq 0 ]]; then
        print_warning "No files found in $uploads_dir to migrate."
        return 0
    fi
    
    print_info "Found $file_count files to migrate"
    
    # Create a temporary container to handle the migration
    print_info "Creating temporary migration container..."
    
    # Resolve host source path (support relative and absolute)
    local host_src="$uploads_dir"
    if [[ "$host_src" != /* ]]; then
        host_src="$PWD/$host_src"
    fi

    docker run --rm \
        --network "$(basename $(pwd))_default" \
        -v "$host_src:/source:ro" \
        -e MINIO_ROOT_USER="$minio_root_user" \
        -e MINIO_ROOT_PASSWORD="$minio_root_password" \
        -e MINIO_BUCKET_NAME="$minio_bucket_name" \
        --entrypoint /bin/sh \
        minio/mc:latest -lc '
            echo "🔗 Setting up MinIO alias for migration...";
            mc alias set minio http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD";
            
            echo "📁 Mirroring host directory to bucket (recursive)...";
            mc mirror --overwrite --preserve /source "minio/$MINIO_BUCKET_NAME";
            
            echo "📊 Mirror complete.";
        '
    
    if [[ $? -eq 0 ]]; then
        print_status "File migration completed successfully!"
        # Non-blocking suggestion for host backup
        if [[ -d "$uploads_dir" ]]; then
            print_info "Tip: To archive local source, run: mv '$uploads_dir' '${uploads_dir}.backup'"
        fi
    else
        print_error "File migration encountered errors. Please check the output above."
        return 1
    fi
}

# Function to restart Docker Compose
restart_docker_compose() {
    echo -n "Restart Docker Compose now to start MinIO and apply changes? [Y/n]: "
    local restart_confirm
    read -r restart_confirm
    restart_confirm=$(echo "$restart_confirm" | tr '[:upper:]' '[:lower:]')
    if [[ -z "$restart_confirm" || "$restart_confirm" == "y" ]]; then
        print_info "Stopping current services..."
        docker compose down
        print_info "Starting services with MinIO..."
        docker compose up -d
        print_status "Docker Compose restarted successfully!"
        return 0
    else
        print_warning "Skipping restart. You can run 'docker compose down && docker compose up -d' later to start MinIO."
        return 1
    fi
}

# Function to wait for a specific service to be up
wait_for_service_up() {
    local service_name="$1"
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if docker compose ps -q "$service_name" >/dev/null 2>&1; then
            print_status "$service_name is up!"
            return 0
        fi
        if [[ $attempt -eq $max_attempts ]]; then
            print_error "$service_name did not become up within expected time. Please check the logs."
            return 1
        fi
        print_info "Attempt $attempt/$max_attempts - waiting for $service_name..."
        sleep 5
        ((attempt++))
    done
}

# Main migration function
migrate_to_minio() {
    echo "🧱 Formbricks MinIO Migration Script for v4.0"
    echo "=============================================="
    echo ""
    
    # Check if we're in the right directory
    check_formbricks_directory
    
    # Check if MinIO is already configured unless migrating only
    if [[ "$MIGRATE_ONLY" != true ]]; then
        if [[ "$FORCE_RECONFIGURE" == true ]]; then
            print_info "Reconfiguring MinIO as requested (--reconfigure)."
        else
            check_minio_configured
        fi
    fi
    
    # Detect current setup (pre-start)
    local main_domain=$(get_main_domain)
    local https_setup=$(detect_https_setup)
    
    if [[ -z "$main_domain" ]]; then
        print_error "Could not detect main domain from docker-compose.yml"
        print_info "Please make sure WEBAPP_URL is configured in your docker-compose.yml"
        exit 1
    fi
    
    print_info "Detected configuration:"
    print_info "  Main domain: $main_domain"
    print_info "  HTTPS setup: $https_setup"
    echo ""
    
    local files_domain
    if [[ "$MIGRATE_ONLY" == true ]]; then
        # Derive files domain from existing S3_ENDPOINT_URL
        files_domain=$(read_compose_value "S3_ENDPOINT_URL" | sed -E 's#^https?://##')
        if [[ -z "$files_domain" ]]; then
            print_error "S3_ENDPOINT_URL not found. Re-run without --migrate-only to configure MinIO."
            exit 1
        fi
        print_info "Using existing files domain: $files_domain"
        # Ensure we have current MinIO credentials in variables for readiness and migration
        generate_minio_credentials
    else
        # Confirm subdomain requirement and get subdomain
        print_warning "IMPORTANT: MinIO requires a subdomain to function properly."
        print_info "You need to have DNS configured for a files subdomain (e.g., files.$main_domain)"
        print_info "Make sure the subdomain points to the same server IP as your main domain."
        echo ""
        echo -n "Do you have a subdomain configured for MinIO? [y/N]: "
        read subdomain_confirmed
        subdomain_confirmed=$(echo "$subdomain_confirmed" | tr '[:upper:]' '[:lower:]')
        if [[ "$subdomain_confirmed" != "y" ]]; then
            print_error "Please configure a subdomain for MinIO before running this migration."
            print_info "Example: Create a DNS A record for files.$main_domain pointing to your server IP"
            exit 1
        fi
        local default_files_domain="files.$main_domain"
        echo -n "Enter the files subdomain for MinIO (e.g., $default_files_domain): "
        read files_domain
        if [[ -z "$files_domain" ]]; then
            files_domain="$default_files_domain"
        fi
        print_info "Using files domain: $files_domain"
        echo ""
    fi
    
    if [[ "$MIGRATE_ONLY" != true ]]; then
        # Generate or rotate MinIO credentials
        generate_minio_credentials
        echo ""
        
        # Backup docker-compose.yml
        backup_docker_compose
        
        # If reconfiguring/rotating creds, remove existing service blocks so reinjection is clean
        if [[ "$REGENERATE_CREDS" == true || "$FORCE_RECONFIGURE" == true ]]; then
            remove_minio_services || true
        fi

    # Add S3 environment variables (updated if credentials rotated)
    add_s3_environment_variables "$files_domain" "$https_setup"
        
        # Add MinIO service
        add_minio_service "$files_domain" "$main_domain" "$https_setup"
        
        # Add MinIO dependency to formbricks
        add_minio_dependency
        
        # Update Traefik configuration
        update_traefik_config
        
        # Add MinIO volume
        add_minio_volume
        
        print_status "Docker Compose configuration updated successfully!"
        echo ""
    else
        print_info "Skipping MinIO reconfiguration (--migrate-only)."
    fi
    
    # Restart Docker Compose when reconfiguring; otherwise ensure services are up
    local restart_success=false
    local proceed_migration=false
    if [[ "$MIGRATE_ONLY" != true ]]; then
        if restart_docker_compose; then
            restart_success=true
            proceed_migration=true
        fi
    else
        # Try to ensure services are up without full restart
        docker compose up -d >/dev/null 2>&1 || true
        proceed_migration=true
    fi

    if [[ "$proceed_migration" == true ]]; then
        restart_success=true
        echo ""
        
        # Ensure formbricks container is up so uploads path is visible
        wait_for_service_up formbricks || true
        
        # Collect multiple sources post-start (rendered compose)
        local sources
        sources=$(collect_upload_sources_post_start)
        preview_upload_sources "$sources"
        
        # If nothing detected, offer manual entry
        if [[ -z "$sources" ]]; then
            read -p "No sources detected. Enter a path (container:/path or ./path) or press Enter to skip: " manual_src
            manual_src=$(echo "$manual_src" | xargs)
            if [[ -n "$manual_src" ]]; then sources="$manual_src"; fi
        fi
        
        if [[ -n "$sources" ]]; then
            echo ""
            read -p "Proceed to migrate from the sources above? [Y/n]: " do_mig
            do_mig=$(echo "$do_mig" | tr '[:upper:]' '[:lower:]')
            if [[ -z "$do_mig" || "$do_mig" == "y" ]]; then
                # Priority: sources as collected from rendered config
                mapfile -t __SRC_ARR__ < <(printf '%s\n' "$sources")
                local MIGRATION_FAILED=0
                local MIGRATION_PLANNED_TOTAL=0
                for src in "${__SRC_ARR__[@]}"; do
                    [[ -z "$src" ]] && continue
                    # compute planned count
                    local planned=0 rc=0
                    if [[ "$src" == container:* ]]; then
                        local p="${src#container:}"
                        planned=$(docker compose exec -T formbricks sh -lc 'find '"$p"' -type f 2>/dev/null | wc -l' || echo 0)
                    else
                        planned=$(find "$src" -type f 2>/dev/null | wc -l || echo 0)
                    fi
                    MIGRATION_PLANNED_TOTAL=$((MIGRATION_PLANNED_TOTAL + planned))
                    migrate_from_source "$src" || rc=$?
                    if [[ $rc -ne 0 ]]; then MIGRATION_FAILED=1; fi
                done
                echo ""
                if [[ $MIGRATION_FAILED -eq 0 ]]; then
                    if [[ $MIGRATION_PLANNED_TOTAL -gt 0 ]]; then
                        print_status "Migration successful."
                    else
                        print_status "No files detected to migrate. Cleaning compose as requested."
                    fi
                    cleanup_uploads_from_compose
                    # Auto-remove minio-init so it won't run again on future 'docker compose up'
                    awk '
                      BEGIN{in_svc=0; skip=0}
                      /^  minio-init:/ {skip=1; next}
                      skip && /^  [A-Za-z0-9_-]+:/ {skip=0}
                      { if(!skip) print }
                    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
                    # Remove depends_on reference from formbricks (portable via awk)
                    awk '
                      BEGIN{in_fb=0}
                      /^  formbricks:/ {in_fb=1}
                      in_fb && /^[[:space:]]*-[[:space:]]*minio-init[[:space:]]*$/ {next}
                      /^  [A-Za-z0-9_-]+:/ && !/^  formbricks:/ {in_fb=0}
                      {print}
                    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml
                    # Remove any stopped container for minio-init and server orphan containers
                    docker compose rm -f -s minio-init >/dev/null 2>&1 || true
                    docker compose up -d --remove-orphans >/dev/null 2>&1 || true
                    print_status "Removed minio-init service, dependency, and cleaned up any leftover container."
                    echo ""
                    read -p "Restart Docker Compose now to apply cleanup changes? [Y/n]: " apply_restart
                    apply_restart=$(echo "$apply_restart" | tr '[:upper:]' '[:lower:]')
                    if [[ -z "$apply_restart" || "$apply_restart" == "y" ]]; then
                        print_info "Applying cleanup changes..."
                        docker compose up -d --remove-orphans
                        print_status "Cleanup applied. Services are up."
                    else
                        print_info "You can apply changes later with: docker compose up -d"
                    fi
                else
                    print_error "Migration failed or no files were found to migrate."
                    echo "Sources detected:"; printf '%s\n' "$sources"
                    print_info "Please copy files manually from the sources above to MinIO, then rerun the script."
                    print_info "Volumes and UPLOADS_DIR were NOT removed from docker-compose.yml."
                fi
            else
                print_warning "Skipped migration at user request."
            fi
        else
            print_warning "No uploads directory detected to migrate."
        fi
    fi
    
    echo ""
    echo "🎉 MinIO Migration Complete!"
    echo "============================="
    echo ""
    print_status "MinIO Configuration:"
    print_info "  Files Domain: $files_domain"
    print_info "  S3 Access Key: $minio_service_user"
    print_info "  S3 Bucket: $minio_bucket_name"
    echo ""
    
    if [[ "$restart_success" == true ]]; then
        print_status "Your Formbricks instance is now using MinIO for file storage!"
        print_info "You can check the status with: docker compose ps"
        print_info "View logs with: docker compose logs"
    else
        print_warning "Remember to restart your Docker Compose setup:"
        print_info "  docker compose down && docker compose up -d"
    fi
    
    echo ""
    print_info "🔒 Important: Save these MinIO credentials securely:"
    echo "Root User: $minio_root_user"
    echo "Root Password: $minio_root_password"
    echo "Service User: $minio_service_user"
    echo "Service Password: $minio_service_password"
    cleanup_sensitive_output
}

# Guarded early definition to avoid 'command not found' in any flow
if ! declare -F cleanup_uploads_from_compose >/dev/null 2>&1; then
cleanup_uploads_from_compose() {
    print_info "Cleaning docker-compose.yml uploads configuration..."
    # 1) Comment out UPLOADS_DIR if present
    if sed --version >/dev/null 2>&1; then sed -i 's/^\([[:space:]]*\)UPLOADS_DIR:[[:space:]].*/\1# UPLOADS_DIR:/' docker-compose.yml || true; else sed -i '' 's/^\([[:space:]]*\)UPLOADS_DIR:[[:space:]].*/\1# UPLOADS_DIR:/' docker-compose.yml || true; fi

    # 2) Remove uploads mapping from formbricks service volumes
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
        print; next
      }
      {print}
    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

    # 3) Remove root-level uploads volume definition
    awk '
      BEGIN{in_root=0; skip=0}
      /^volumes:[[:space:]]*$/ {print; in_root=1; next}
      in_root && /^[^[:space:]]/ {in_root=0}
      in_root {
        if ($0 ~ /^  uploads:[[:space:]]*$/) {skip=1; next}
        if (skip) {
          if ($0 ~ /^  [A-Za-z0-9_-]+:[[:space:]]*$/) {skip=0; print; next}
          next
        }
        print; next
      }
      {print}
    ' docker-compose.yml > tmp.yml && mv tmp.yml docker-compose.yml

    print_status "Removed uploads volume mapping and UPLOADS_DIR."
}
fi

# Check if script is being run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    migrate_to_minio
fi
