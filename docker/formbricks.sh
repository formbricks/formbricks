#!/bin/env bash

set -e
ubuntu_version=$(lsb_release -a 2>/dev/null | grep -v "No LSB modules are available." | grep "Description:" | awk -F "Description:\t" '{print $2}')

install_formbricks() {
  # Friendly welcome
  echo "🧱 Welcome to the Formbricks Setup Script"
  echo ""
  echo "🛸 Fasten your seatbelts! We're setting up your Formbricks environment on your $ubuntu_version server with microK8s."
  echo ""

  # Update package list
  echo "🔄 Updating your package list."
  sudo apt-get update >/dev/null 2>&1

  # Install dependencies
  echo "📦 Installing the necessary dependencies."
  sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    snapd >/dev/null 2>&1

  # Install microK8s
  echo "☸️  Installing microK8s Kubernetes..."
  sudo snap install microk8s --classic >/dev/null 2>&1

  # Add user to microk8s group
  echo "👥 Adding your user to the microk8s group..."
  sudo usermod -a -G microk8s $USER >/dev/null 2>&1
  sudo mkdir -p ~/.kube >/dev/null 2>&1
  sudo chown -R $USER ~/.kube >/dev/null 2>&1

  # Create alias for kubectl
  echo "🔧 Creating kubectl alias..."
  sudo snap alias microk8s.kubectl kubectl >/dev/null 2>&1

  # Wait for microk8s to be ready
  echo "⏳ Waiting for microK8s to be ready..."
  sudo microk8s status --wait-ready >/dev/null 2>&1

  # Setting up microK8s configuration
  mkdir -p ~/.kube
  sudo microk8s config > ~/.kube/config
  sudo chown -R $USER ~/.kube

  # Enable required add-ons
  echo "🔌 Enabling required microK8s add-ons (DNS, storage, ingress, helm3, cert-manager)..."
  sudo microk8s enable dns storage ingress helm3 cert-manager >/dev/null 2>&1

  echo "⏳ Waiting for add-ons to be ready..."
  sleep 10

  # Create formbricks directory
  mkdir -p formbricks && cd formbricks
  echo "📁 Created Formbricks directory at ./formbricks."

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

      # Create ClusterIssuer for Let's Encrypt
      echo "🔒 Creating Let's Encrypt certificate issuer..."
      cat <<EOT > cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: ${email_address}
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          ingressClassName: public
EOT

      kubectl apply -f cluster-issuer.yaml
    else
      echo "❌ Ports 80 & 443 are not open. We can't help you in providing the SSL certificate."
      https_setup="n"
    fi
  else
    https_setup="n"
  fi

  # Prompt for email service setup
  read -p "📧 Do you want to set up the email service? You will need SMTP credentials for the same! [y/N]" email_service
  email_service=$(echo "$email_service" | tr '[:upper:]' '[:lower:]')

  # Set default value for email service setup
  if [[ -z $email_service ]]; then
    email_service="n"
  fi

  # Create values file for Helm chart
  echo "📝 Creating values file for Helm chart..."
  cat <<EOT > values.yaml
# Formbricks helm chart values
deployment:
  env:
    NEXTAUTH_URL:
      value: "https://${domain_name}"
    WEBAPP_URL:
      value: "https://${domain_name}"
    DOCKER_CRON_ENABLED:
      value: "0"
EOT

  # Add email configuration if selected
  if [[ $email_service == "y" ]]; then
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

    echo -n "Enter your SMTP password: "
    read smtp_password

    echo -n "Enable Authenticated SMTP? Enter 1 for yes and 0 for no(default is 1): "
    read smtp_authenticated

    echo -n "Enable Secure SMTP (use SSL)? Enter 1 for yes and 0 for no: "
    read smtp_secure_enabled

    # Add SMTP configuration to values.yaml
    cat <<EOT >> values.yaml
    MAIL_FROM: "${mail_from}"
    MAIL_FROM_NAME: "${mail_from_name}"
    SMTP_HOST: "${smtp_host}"
    SMTP_PORT: "${smtp_port}"
    SMTP_USER: "${smtp_user}"
    SMTP_PASSWORD: "${smtp_password}"
    SMTP_AUTHENTICATED: ${smtp_authenticated:-1}
    SMTP_SECURE_ENABLED: ${smtp_secure_enabled:-0}
EOT
  fi

  # Configure ingress with SSL
  if [[ $https_setup == "y" ]]; then
    cat <<EOT >> values.yaml
ingress:
  enabled: true
  ingressClassName: public
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    kubernetes.io/tls-acme: "true"
  hosts:
    - host: ${domain_name}
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: formbricks-tls
      hosts:
        - ${domain_name}
EOT
  else
    cat <<EOT >> values.yaml
ingress:
  enabled: true
  ingressClassName: public
  hosts:
    - host: ${domain_name}
      paths:
        - path: /
          pathType: Prefix
EOT
  fi

  # Create a namespace for Formbricks
    echo "🚀 Ensuring namespace 'formbricks' exists..."
    if ! kubectl get namespace formbricks >/dev/null 2>&1; then
      kubectl create namespace formbricks
      echo "✅ Namespace 'formbricks' created."
    else
      echo "ℹ️  Namespace 'formbricks' already exists."
    fi

  # Add helm repo and update
#  echo "⚓ Adding Formbricks Helm repository..."
#  microk8s helm3 repo add formbricks-repo oci://ghcr.io/formbricks/helm-charts
#  microk8s helm3 repo update

  # Install Formbricks with Helm
  echo "🚀 Installing Formbricks via Helm chart..."
  microk8s helm3 install formbricks oci://ghcr.io/formbricks/helm-charts/formbricks -n formbricks --create-namespace -f values.yaml

  echo "⏳ Waiting for Formbricks to be ready..."
  kubectl -n formbricks rollout status deployment formbricks

  echo "🚨 Make sure you have set up the DNS records for ${domain_name} pointing to this server's IP address."
  echo ""
  echo "🎉 All done! Please setup your Formbricks instance by visiting your domain at https://${domain_name}."
  echo "You can check the status of your deployment with 'kubectl get all -n formbricks'"
}

uninstall_formbricks() {
  echo "🗑️ Preparing to Uninstall Formbricks..."
  read -p "Are you sure you want to uninstall Formbricks? This will delete all the data associated with it! (yes/no): " uninstall_confirmation
  uninstall_confirmation=$(echo "$uninstall_confirmation" | tr '[:upper:]' '[:lower:]')
  if [[ $uninstall_confirmation == "yes" ]]; then
    cd formbricks
    microk8s helm3 uninstall formbricks -n formbricks
    kubectl delete namespace formbricks
    echo "🛑 Formbricks uninstalled successfully!"
  else
    echo "❌ Uninstalling Formbricks has been cancelled."
  fi
}

stop_formbricks() {
  echo "🛑 Stopping Formbricks..."
  kubectl scale deployment formbricks --replicas=0 -n formbricks
  echo "🎉 Formbricks instance scaled down to zero successfully!"
}

update_formbricks() {
  echo "🔄 Updating Formbricks..."
  cd formbricks
  microk8s helm3 repo update
  microk8s helm3 upgrade formbricks oci://ghcr.io/formbricks/helm-charts/formbricks -n formbricks -f values.yaml
  echo "🎉 Formbricks updated successfully!"
  echo "🎉 Check the status of Formbricks with 'kubectl get pods -n formbricks'"
}

restart_formbricks() {
  echo "🔄 Restarting Formbricks..."
  kubectl rollout restart deployment formbricks -n formbricks
  echo "🎉 Formbricks restarted successfully!"
}

get_logs() {
  echo "📃 Getting Formbricks logs..."
  kubectl logs -l app.kubernetes.io/name=formbricks -n formbricks --tail=100
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
