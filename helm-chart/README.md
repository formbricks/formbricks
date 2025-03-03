<div id="top"></div>

<p align="center">

<a href="https://formbricks.com">

<img width="120" alt="Open Source Privacy First Experience Management Solution Qualtrics Alternative Logo" src="https://github.com/formbricks/formbricks/assets/72809645/0086704f-bee7-4d38-9cc8-fa42ee59e004">

</a>

<h3 align="center">Formbricks</h3>

<p align="center">
Harvest user-insights, build irresistible experiences.
<br />
<a href="https://formbricks.com/">Website</a>
</p>
</p>

# Formbricks Helm Chart: Comprehensive Documentation

- [Formbricks Helm Chart: Comprehensive Documentation](#formbricks-helm-chart-comprehensive-documentation)
  - [Introduction](#introduction)
  - [Prerequisites](#prerequisites)
  - [Chart Components](#chart-components)
  - [Installation](#installation)
    - [Quick Start](#quick-start)
    - [Usage Examples](#usage-examples)
      - [Scaling PostgreSQL and Redis](#scaling-postgresql-and-redis)
    - [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Scaling](#scaling)
    - [With Auto Scaling (Kubernetes Metrics Server Requirement)](#with-auto-scaling-kubernetes-metrics-server-requirement)
    - [Customizing Autoscaling](#customizing-autoscaling)
    - [Kubernetes Metrics Server Requirement](#kubernetes-metrics-server-requirement)
    - [Advanced Autoscaling Configuration](#advanced-autoscaling-configuration)
  - [Upgrading Formbricks](#upgrading-formbricks)
    - [Upgrade Process](#upgrade-process)
    - [Common Upgrade Scenarios](#common-upgrade-scenarios)
      - [1. Updating Environment Variables](#1-updating-environment-variables)
      - [2. Enabling or Disabling Features](#2-enabling-or-disabling-features)
      - [3. Scaling Resources](#3-scaling-resources)
      - [4. Updating Autoscaling Configuration](#4-updating-autoscaling-configuration)
      - [5. Changing Database Credentials](#5-changing-database-credentials)
    - [Using a Values File for Complex Upgrades](#using-a-values-file-for-complex-upgrades)
  - [Support](#support)
  - [Full Values Documentation](#full-values-documentation)
  - [✍️ Contribution](#️-contribution)
  - [MicroK8s Installation and Formbricks Deployment](#microk8s-installation-and-formbricks-deployment)
    - [MicroK8s Quick Setup](#microk8s-quick-setup)
    - [Deploying Formbricks on MicroK8s](#deploying-formbricks-on-microk8s)

## Introduction

This Helm chart deploys Formbricks, an advanced open-source form builder and survey tool, along with its required dependencies (PostgreSQL and Redis) on a Kubernetes cluster. It also includes an optional Traefik ingress controller for easy access and SSL termination.

## Prerequisites

Before installing the Formbricks Helm chart, ensure you have the following:

- Kubernetes cluster version 1.24 or later
- Helm version 3.2.0 or later
- Dynamic volume provisioning support in the underlying infrastructure (for PostgreSQL persistence)
- Familiarity with Kubernetes concepts and Helm charts

## Chart Components

This Helm chart deploys the following components:

1. **Formbricks Application**: The core Formbricks service.
2. **PostgreSQL Database**: (Optional) A relational database for Formbricks data.
3. **Redis**: (Optional) An in-memory data structure store for caching.
4. **Traefik Ingress Controller**: (Optional) A modern HTTP reverse proxy and load balancer.

## Installation

### Quick Start

To quickly deploy Formbricks with default settings:

1. clone the formbricks repository and navigate to the helm-chart directory:

   ```bash
   git clone https://github.com/formbricks/formbricks.git
   cd formbricks/helm-chart
   ```

2. Deploy Formbricks

   ```bash
     helm install my-formbricks ./ \
      --namespace formbricks \
      --create-namespace \
      --set replicaCount=2
   ```

This will deploy Formbricks with default settings, including a new PostgreSQL instance, Redis and Traefik disabled.

### Verify and Access Formbricks

After deploying Formbricks, you can verify the installation and access the application:

1. Check the Running Services:

   ```bash
   kubectl get pods -n formbricks
   kubectl get svc -n formbricks
   kubectl get ingress -n formbricks
   ```

   > **Note:** The Formbricks application pod may take some time to reach a stable state as it runs database migrations during startup.

2. Access Formbricks:
   - If running locally with **Minikube**:
     ```bash
     minikube service my-formbricks -n formbricks
     ```
   - If deployed on a **cloud cluster**, visit:
     ```
     https://formbricks.example.com
     ```
     (Replace with your configured hostname)

### Usage Examples

Here are various examples of how to install and configure the Formbricks Helm chart:

1. **Default Installation with Traefik enabled and Custom Hostname**:

   <details>

   <summary>Option 1: Installation without SSL (Not recommended for production)</summary>

   ```bash
   helm install my-formbricks formbricks/formbricks \
     --namespace formbricks \
     --create-namespace \
     --set traefik.enabled=true \
     --set hostname=forms.example.com
   ```

````

This command enables Traefik and sets a custom hostname. Replace `forms.example.com` with your actual domain name.

   </details>

   <details>
   <summary>Option 2: Installation with SSL (Recommended for production)</summary>

1.  First, download the values file:

```bash
helm show values formbricks/formbricks > values.yaml
```

2.  Open the `values.yaml` file in a text editor and make the following changes:

```yaml
traefik:
  enabled: true
  additionalArguments:
    - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
```

Replace `your-email@example.com` with a valid email address where you want to receive Let's Encrypt notifications.

3.  Install Formbricks with the updated values file:

```bash
helm install my-formbricks formbricks/formbricks \
  -f values.yaml \
  --namespace formbricks \
  --create-namespace \
  --set hostname=forms.example.com
```

This command enables Traefik, sets a custom hostname, and uses the configured email address for Let's Encrypt. Remember to replace `forms.example.com` with your actual domain name.

   </details>

These installation options provide flexibility in setting up Formbricks with Traefik. The SSL option is recommended for production environments to ensure secure communications.

2.  **Community Advanced:**
    Provision a whole community setup with Formbricks, Postgres, Custom Domain with SSL

          ```bash
          helm install formbricks formbricks/formbricks \
            --namespace formbricks \
            --create-namespace \
             --set postgres.enabled=true \
            --set traefik.enabled=true \
            --set hostname=forms.example.com \
            --set email=your-mail@example.com
          ```

3.  **Cluster Advanced:**
    Provision a ready to use cluster for enterprise customers with Formbricks (3 pods), Postgres, Redis and Custom Domain with SSL

          ```bash
          helm install formbricks formbricks/formbricks \
            --namespace formbricks \
            --create-namespace \
            --set replicaCount=3
            --set redis.enabled=true \
            --set traefik.enabled=true \
            --set hostname=forms.example.com \
            --set email=your-mail@example.com
          ```

4.  **Installation with Redis and PostgreSQL Disabled, Using External Services**:

    ```bash
    helm install my-formbricks formbricks/formbricks \
      --namespace formbricks \
      --create-namespace \
      --set postgresql.enabled=false \
      --set postgresql.externalUrl=postgresql://user:password@your-postgres-url:5432/dbname \
      --set redis.enabled=false \
      --set redis.externalUrl=redis://your-redis-url:6379
    ```

5.  **High Availability Setup**:
    ```bash
    helm install my-formbricks formbricks/formbricks \
    --namespace formbricks \
    --create-namespace \
    --set replicaCount=3
    ```

This command:

1. Deploys the Formbricks application with 3 replicas.
2. Enables PostgreSQL and Redis with default settings.

#### Scaling PostgreSQL and Redis

For advanced configuration and scaling of PostgreSQL and Redis, refer to their respective Helm chart documentation:

- PostgreSQL Helm Chart: https://github.com/bitnami/charts/tree/master/bitnami/postgresql
- Redis Helm Chart: https://github.com/bitnami/charts/tree/master/bitnami/redis

These documents provide detailed information on scaling and configuring high availability for each component.

4. **Custom Configuration with Environment Variables**:

   ```bash
   helm install my-formbricks formbricks/formbricks \
     --namespace formbricks \
     --create-namespace \
     --set env.SMTP_HOST=smtp.example.com \
     --set env.SMTP_PORT=587 \
     --set env.SMTP_USER=user@example.com \
     --set env.SMTP_PASSWORD=password123 \
     --set env.SMTP_AUTHENTICATED=1
   ```

5. **Installation with Custom Resource Limits**:
   ```bash
   helm install my-formbricks formbricks/formbricks \
     --namespace formbricks \
     --create-namespace \
     --set resources.limits.cpu=1 \
     --set resources.limits.memory=1Gi \
     --set resources.requests.cpu=500m \
     --set resources.requests.memory=512Mi
   ```

### Configuration

For detailed configuration options, please refer to the [Full Values Documentation](#full-values-documentation) section at the end of this document.

## Environment Variables

Formbricks supports various environment variables for configuration. Here are some key variables:

| Variable          | Description                      | Required | Default                 |
| ----------------- | -------------------------------- | -------- | ----------------------- |
| `WEBAPP_URL`      | Base URL of the site             | Yes      | `http://localhost:3000` |
| `NEXTAUTH_URL`    | Location of the auth server      | Yes      | `http://localhost:3000` |
| `DATABASE_URL`    | Database URL with credentials    | Yes      | -                       |
| `NEXTAUTH_SECRET` | Secret for NextAuth              | Yes      | (Generated)             |
| `ENCRYPTION_KEY`  | Secret for data encryption       | Yes      | (Generated)             |
| `CRON_SECRET`     | API Secret for running cron jobs | Yes      | (Generated)             |
| `...`             | ...                              | ...      | ...                     |

For a comprehensive list of supported environment variables, refer to the [Formbricks Configuration Documentation](https://formbricks.com/docs/self-hosting/configuration).

## Scaling

```bash
kubectl scale deployment my-formbricks --replicas=5 -n formbricks
```

This command scales the Formbricks deployment to 5 replicas. Replace `my-formbricks` with your actual deployment name if different.

### With Auto Scaling (Kubernetes Metrics Server Requirement)

The Formbricks Helm chart includes support for Horizontal Pod Autoscaling (HPA) to automatically adjust the number of pods based on CPU utilization. This feature is enabled by default and can be customized to suit your specific needs.

```bash
helm install my-formbricks formbricks/formbricks --namespace formbricks --create-namespace \
  --set autoscaling.enabled=true
```

This configuration sets up autoscaling with a minimum of 2 replicas and a maximum of 5 replicas, targeting an average CPU utilization of 80%

### Customizing Autoscaling

To adjust the autoscaling settings, you can modify the values in your `values.yaml` file or use the `--set` flag when installing or upgrading the chart. Here are some common customizations:

1. Change the minimum and maximum number of replicas:

```bash
helm install my-formbricks formbricks/formbricks \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=10
```

2. Adjust the target CPU utilization:

```bash
helm install my-formbricks formbricks/formbricks \
  --set autoscaling.enabled=true \
  --set autoscaling.metrics[0].resource.target.averageUtilization=70
```

3. Disable autoscaling:

```bash
helm upgrade my-formbricks formbricks/formbricks \
  --set autoscaling.enabled=false
```

### Kubernetes Metrics Server Requirement

For autoscaling to function properly, the Kubernetes Metrics Server must be installed in your cluster. The Metrics Server collects resource metrics from Kubelets and exposes them in the Kubernetes API server through the Metrics API.

If you don't have the Metrics Server installed, you can typically add it using the following command:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

For more detailed information on installing and configuring the Metrics Server, please refer to the [official Kubernetes Metrics Server documentation](https://github.com/kubernetes-sigs/metrics-server).

### Advanced Autoscaling Configuration

The Formbricks Helm chart uses Kubernetes HPA v2, which allows for more advanced scaling behaviors. You can customize the `behavior` section in the `values.yaml` file to fine-tune how your application scales up and down. For more information on advanced HPA configurations, refer to the [Kubernetes HPA documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/).

## Upgrading Formbricks

This section provides guidance on how to upgrade your Formbricks deployment using Helm, including examples of common upgrade scenarios.

### Upgrade Process

To upgrade your Formbricks deployment, use the `helm upgrade` command. Always ensure you have the latest version of the Formbricks Helm chart by running `helm repo update` before upgrading.

```bash
helm repo update
helm upgrade my-formbricks formbricks/formbricks --namespace formbricks
```

### Common Upgrade Scenarios

#### 1. Updating Environment Variables

To update or add new environment variables, use the `--set` flag with the `env` prefix:

```bash
helm upgrade my-formbricks formbricks/formbricks \
  --set env.SMTP_HOST=new-smtp.example.com \
  --set env.SMTP_PORT=587 \
  --set env.NEW_CUSTOM_VAR=newvalue
```

This command updates the SMTP host and port, and adds a new custom environment variable.

#### 2. Enabling or Disabling Features

You can enable or disable features by updating their respective values:

```bash
# Disable Redis
helm upgrade my-formbricks formbricks/formbricks --set redis.enabled=false

# Enable Redis
helm upgrade my-formbricks formbricks/formbricks --set redis.enabled=true
```

#### 3. Scaling Resources

To adjust resource allocation:

```bash
helm upgrade my-formbricks formbricks/formbricks \
  --set resources.limits.cpu=1 \
  --set resources.limits.memory=2Gi \
  --set resources.requests.cpu=500m \
  --set resources.requests.memory=1Gi
```

#### 4. Updating Autoscaling Configuration

To modify autoscaling settings:

```bash
helm upgrade my-formbricks formbricks/formbricks \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=10 \
  --set autoscaling.metrics[0].resource.target.averageUtilization=75
```

#### 5. Changing Database Credentials

To update PostgreSQL database credentials:
To switch from the built-in PostgreSQL to an external database or update the external database credentials:

```bash
helm upgrade my-formbricks formbricks/formbricks \
  --set postgresql.enabled=false \
  --set postgresql.externalUrl="postgresql://newuser:newpassword@external-postgres-host:5432/newdatabase"
```

This command disables the built-in PostgreSQL and configures Formbricks to use an external PostgreSQL database. Make sure your external database is set up and accessible before making this change.

### Using a Values File for Complex Upgrades

For more complex upgrades or when you need to change multiple values, it's recommended to use a values file:

1. Create a file named `upgrade-values.yaml` with your desired changes:

   ```yaml
   env:
     SMTP_HOST: new-smtp.example.com
     SMTP_PORT: "587"
   resources:
     limits:
       cpu: 1
       memory: 2Gi
   autoscaling:
     minReplicas: 3
     maxReplicas: 10
   traefik:
     enabled: true
   postgresql:
     auth:
       username: newuser
       password: newpassword
       database: newdatabase
   ```

2. Apply the upgrade using the values file:

   ```bash
   helm upgrade my-formbricks formbricks/formbricks -f upgrade-values.yaml
   ```

Remember to always backup your data before performing upgrades, especially when modifying database-related settings.

## Support

For support with the Formbricks Helm chart:

- Open an issue on the [Formbricks GitHub repository](https://github.com/formbricks/formbricks)
- Get help on [Github Discussions](https://github.com/formbricks/formbricks/discussions)
- For enterprise support, contact us at hola@formbricks.com

## Full Values Documentation

Below is a comprehensive list of all configurable values in the Formbricks Helm chart:

| Field                                                       | Description                                | Default                         |
| ----------------------------------------------------------- | ------------------------------------------ | ------------------------------- |
| `image.repository`                                          | Docker image repository for Formbricks     | `ghcr.io/formbricks/formbricks` |
| `image.pullPolicy`                                          | Image pull policy                          | `IfNotPresent`                  |
| `image.tag`                                                 | Docker image tag                           | `"2.6.0"`                       |
| `service.type`                                              | Kubernetes service type                    | `ClusterIP`                     |
| `service.port`                                              | Kubernetes service port                    | `80`                            |
| `service.targetPort`                                        | Container port to expose                   | `3000`                          |
| `resources.limits.cpu`                                      | CPU resource limit                         | `500m`                          |
| `resources.limits.memory`                                   | Memory resource limit                      | `1Gi`                           |
| `resources.requests.cpu`                                    | Memory resource request                    | `null`                          |
| `resources.requests.memory`                                 | Memory resource request                    | `null`                          |
| `autoscaling.enabled`                                       | Enable autoscaling                         | `false`                         |
| `autoscaling.minReplicas`                                   | Minimum number of replicas                 | `1`                             |
| `autoscaling.maxReplicas`                                   | Maximum number of replicas                 | `5`                             |
| `autoscaling.metrics[0].type`                               | Type of metric for autoscaling             | `Resource`                      |
| `autoscaling.metrics[0].resource.name`                      | Resource name for autoscaling metric       | `cpu`                           |
| `autoscaling.metrics[0].resource.target.type`               | Target type for autoscaling                | `Utilization`                   |
| `autoscaling.metrics[0].resource.target.averageUtilization` | Average utilization target for autoscaling | `80`                            |
| `autoscaling.behavior.scaleDown.stabilizationWindowSeconds` | Stabilization window for scaling down      | `300`                           |
| `autoscaling.behavior.scaleUp.stabilizationWindowSeconds`   | Stabilization window for scaling up        | `0`                             |
| `replicaCount`                                              | Number of replicas                         | `1`                             |
| `formbricksConfig.nextAuthSecret`                           | NextAuth secret                            | `""`                            |
| `formbricksConfig.encryptionKey`                            | Encryption key                             | `""`                            |
| `formbricksConfig.cronSecret`                               | Cron secret                                | `""`                            |
| `env`                                                       | Additional environment variables           | `{}`                            |
| `hostname`                                                  | Hostname for Formbricks                    | `""`                            |
| `traefik.enabled`                                           | Enable Traefik ingress                     | `false`                         |
| `traefik.ingressRoute.dashboard.enabled`                    | Enable Traefik dashboard                   | `false`                         |
| `traefik.additionalArguments`                               | Additional arguments for Traefik           | [See values.yaml]               |
| `traefik.tls.enabled`                                       | Enable TLS for Traefik                     | `true`                          |
| `traefik.tls.certResolver`                                  | Cert resolver for Traefik                  | `letsencrypt`                   |
| `traefik.ports.web.port`                                    | HTTP port for Traefik                      | `80`                            |
| `traefik.ports.websecure.port`                              | HTTPS port for Traefik                     | `443`                           |
| `traefik.persistence.enabled`                               | Enable persistence for Traefik             | `true`                          |
| `traefik.persistence.size`                                  | Size of persistent volume for Traefik      | `128Mi`                         |
| `traefik.podSecurityContext.fsGroup`                        | fsGroup for Traefik pods                   | `0`                             |
| `traefik.hostNetwork`                                       | Use host network for Traefik               | `true`                          |
| `traefik.securityContext`                                   | Security context for Traefik               | [See values.yaml]               |
| `redis.enabled`                                             | Enable Redis                               | `true`                          |
| `redis.externalUrl`                                         | External Redis URL                         | `""`                            |
| `redis.architecture`                                        | Redis architecture                         | `standalone`                    |
| `redis.auth.enabled`                                        | Enable Redis authentication                | `true`                          |
| `redis.auth.password`                                       | Redis password                             | `redispassword`                 |
| `redis.master.persistence.enabled`                          | Enable persistence for Redis master        | `false`                         |
| `redis.replica.replicaCount`                                | Number of Redis replicas                   | `0`                             |
| `postgresql.enabled`                                        | Enable PostgreSQL                          | `true`                          |
| `postgresql.externalUrl`                                    | External PostgreSQL URL                    | `""`                            |
| `postgresql.auth.username`                                  | PostgreSQL username                        | `formbricks`                    |
| `postgresql.auth.password`                                  | PostgreSQL password                        | `formbrickspassword`            |
| `postgresql.auth.database`                                  | PostgreSQL database name                   | `formbricks`                    |
| `postgresql.primary.persistence.enabled`                    | Enable persistence for PostgreSQL          | `true`                          |
| `postgresql.primary.persistence.size`                       | Size of persistent volume for PostgreSQL   | `10Gi`                          |

This table provides a comprehensive overview of all configurable fields in the Formbricks Helm chart, along with their descriptions and default values. Users can refer to this table to understand what each field does and how they can customize their Formbricks deployment.

## Full Values Documentation

Below is a comprehensive list of all configurable values in the Formbricks Helm chart:

```yaml
image:
  repository: ghcr.io/formbricks/formbricks
  pullPolicy: IfNotPresent
  tag: "2.6.0"

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

resources:
  limits:
    cpu: 500m
    memory: 1Gi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max

replicaCount: 1

formbricksConfig:
  nextAuthSecret: ""
  encryptionKey: ""
  cronSecret: ""

env: {}

hostname: ""

traefik:
  enabled: false
  ingressRoute:
    dashboard:
      enabled: false
  additionalArguments:
    - "--providers.file.filename=/config/traefik.toml"
  tls:
    enabled: true
    certResolver: letsencrypt
  ports:
    web:
      port: 80
    websecure:
      port: 443
      tls:
        enabled: true
        certResolver: letsencrypt
  persistence:
    enabled: true
    name: traefik-acme
    accessMode: ReadWriteOnce
    size: 128Mi
    path: /data
  podSecurityContext:
    fsGroup: 0
  hostNetwork: true
  securityContext:
    capabilities:
      drop:
        - ALL
      add:
        - NET_ADMIN
        - NET_BIND_SERVICE
        - NET_BROADCAST
        - NET_RAW
    runAsUser: 0
    runAsGroup: 0
    runAsNonRoot: false
    readOnlyRootFilesystem: true

redis:
  enabled: false
  externalUrl: ""
  architecture: standalone
  auth:
    enabled: true
    password: redispassword
  master:
    persistence:
      enabled: false
  replica:
    replicaCount: 0

postgresql:
  enabled: false
  externalUrl: ""
  auth:
    username: formbricks
    password: formbrickspassword
    database: formbricks
  primary:
    persistence:
      enabled: true
      size: 10Gi
```

You can customize these values by creating a `values.yaml` file or by using the `--set` flag when running `helm install` or `helm upgrade`.

## ✍️ Contribution

We are very happy if you are interested in contributing to Formbricks 🤗

Here are a few options:

- Star this repo.

- Create issues every time you feel something is missing or goes wrong.

- Upvote issues with 👍 reaction so we know what the demand for a particular issue is to prioritize it within the roadmap.

Please check out [our contribution guide](https://formbricks.com/docs/developer-docs/contributing/get-started) and our [list of open issues](https://github.com/formbricks/formbricks/issues) for more information.

## MicroK8s Installation and Formbricks Deployment

### MicroK8s Quick Setup

1. Install MicroK8s:

   ```bash
   sudo snap install microk8s --classic
   ```

2. Enable necessary add-ons:
   ```bash
   microk8s enable dns storage ingress helm3
   ```

### Deploying Formbricks on MicroK8s

1. Add the Formbricks Helm repository:

   ```bash
   microk8s helm3 repo add formbricks https://charts.formbricks.com
   microk8s helm3 repo update
   ```

2. Install Formbricks:
   ```bash
   microk8s helm3 install my-formbricks formbricks/formbricks --namespace formbricks --create-namespace
   ```

For more detailed information on MicroK8s, including advanced configuration and usage, please refer to the [official MicroK8s documentation](https://microk8s.io/docs).

For Formbricks Helm chart configuration options, see the [Configuration](#configuration) and [Full Values Documentation](#full-values-documentation) sections of this document.
```
````
