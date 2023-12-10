#!/bin/bash
function install_yq() {
  if ! command -v yq &>/dev/null; then
    case "$(uname -s)" in
    Darwin*)
      echo 'Installing yq for MacOS'
      brew install yq
      ;;
    Linux*)
      echo 'Installing yq for Linux'
      ARCH=$(uname -m)
      case "$ARCH" in
      "x86_64")
        ARCH_TYPE="amd64"
        ;;
      "aarch64" | "arm64")
        ARCH_TYPE="arm64"
        ;;
      *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
      esac
      sudo wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_$ARCH_TYPE -O /usr/bin/yq && sudo chmod +x /usr/bin/yq
      ;;
    *)
      echo 'Unsupported OS: unknown'
      exit 1
      ;;
    esac
  fi
}

function demo() {
  bash ./scripts/setup-demo.bash
  cd apps/demo
  cp .env.example .env
  turbo --filter "@formbricks/demo" go
}

function website() {
  turbo --filter "@formbricks/formbricks-com" dev
}

function init_formbricks() {
  cp .env.example .env
  bash ./scripts/init.bash
  turbo --filter "@formbricks/js" build
}

function web() {
  bash ./scripts/setup-web.bash
  turbo --filter "@formbricks/database" db:down
  cp .env.example .env
  RANDOM_ENCRYPTION_KEY=$(openssl rand -hex 32)
  sed -i.bak 's/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY='"$RANDOM_ENCRYPTION_KEY"'/' .env && rm .env.bak
  cp .env ./apps/web/
  open http://localhost:3000
  open http://localhost:8025
  turbo --filter "@formbricks/web" go

}

install_yq
init_formbricks
web
website
demo