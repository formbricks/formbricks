#!/bin/env bash

set -e

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for required commands
for cmd in lsb_release curl docker; do
  if ! command_exists "$cmd"; then
    echo "❌ Error: $cmd is not installed. Please install it and try again."
    exit 1
  fi
done

ubuntu_version=$(lsb_release -a 2>/dev/null | grep -v "No LSB modules are available." | grep "Description:" | awk -F "Description:\t" '{print $2}')

# Function to log messages
log_message() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> formbricks_setup.log
}

install_formbricks() {
  log_message "Starting Formbricks installation."
  echo "🧱 Welcome to the Formbricks Setup Script"
  
  # Old Docker removal and updates...
  # (rest of your existing install_formbricks code)

  # Check if domain is valid
  if ! [[ "$domain_name" =~ ^[a-zA-Z0-9.-]+$ ]]; then
    echo "❌ Invalid domain name. Please enter a valid domain."
    exit 1
  fi

  # (rest of your existing install_formbricks code)
  log_message "Formbricks installation completed."
}

uninstall_formbricks() {
  log_message "Preparing to uninstall Formbricks."
  echo "🗑️ Uninstalling Formbricks..."
  # (rest of your existing uninstall_formbricks code)
}

# (rest of your functions...)

# Display script version
if [[ "$1" == "--version" ]]; then
  echo "Formbricks Setup Script version 1.0"
  exit 0
fi

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
