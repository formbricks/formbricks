# formbricks

![Version: 0.2.0](https://img.shields.io/badge/Version-0.2.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square)

A Helm chart for Formbricks with PostgreSQL, Redis, Traefik, and cert-manager

**Homepage:** <https://formbricks.com/>

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| Formbricks | <info@formbricks.com> |  |

## Requirements

| Repository | Name | Version |
|------------|------|---------|
| oci://registry-1.docker.io/bitnamicharts | postgresql | 16.4.16 |
| oci://registry-1.docker.io/bitnamicharts | redis | 20.11.2 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| autoscaling.additionalLabels | object | `{}` |  |
| autoscaling.annotations | object | `{}` |  |
| autoscaling.enabled | bool | `true` |  |
| autoscaling.maxReplicas | int | `10` |  |
| autoscaling.metrics[0].resource.name | string | `"cpu"` |  |
| autoscaling.metrics[0].resource.target.averageUtilization | int | `60` |  |
| autoscaling.metrics[0].resource.target.type | string | `"Utilization"` |  |
| autoscaling.metrics[0].type | string | `"Resource"` |  |
| autoscaling.metrics[1].resource.name | string | `"memory"` |  |
| autoscaling.metrics[1].resource.target.averageUtilization | int | `60` |  |
| autoscaling.metrics[1].resource.target.type | string | `"Utilization"` |  |
| autoscaling.metrics[1].type | string | `"Resource"` |  |
| autoscaling.minReplicas | int | `1` |  |
| componentOverride | string | `""` |  |
| cronJob.enabled | bool | `false` |  |
| cronJob.jobs | object | `{}` |  |
| deployment.additionalLabels | object | `{}` |  |
| deployment.additionalPodAnnotations | object | `{}` |  |
| deployment.additionalPodLabels | object | `{}` |  |
| deployment.affinity | object | `{}` |  |
| deployment.annotations | object | `{}` |  |
| deployment.args | list | `[]` |  |
| deployment.command | list | `[]` |  |
| deployment.containerSecurityContext.readOnlyRootFilesystem | bool | `true` |  |
| deployment.containerSecurityContext.runAsNonRoot | bool | `true` |  |
| deployment.env.TEST.value | string | `"test"` |  |
| deployment.envFrom.app-secrets.nameSuffix | string | `"app-secrets"` |  |
| deployment.envFrom.app-secrets.type | string | `"secret"` |  |
| deployment.image.digest | string | `""` |  |
| deployment.image.pullPolicy | string | `"IfNotPresent"` |  |
| deployment.image.repository | string | `"ghcr.io/formbricks/formbricks"` |  |
| deployment.image.tag | string | `"v3.2.0"` |  |
| deployment.imagePullSecrets | string | `""` |  |
| deployment.nodeSelector | object | `{}` |  |
| deployment.ports.http.containerPort | int | `3000` |  |
| deployment.ports.http.exposed | bool | `true` |  |
| deployment.ports.http.protocol | string | `"TCP"` |  |
| deployment.probes.livenessProbe.failureThreshold | int | `5` |  |
| deployment.probes.livenessProbe.httpGet.path | string | `"/health"` |  |
| deployment.probes.livenessProbe.httpGet.port | int | `3000` |  |
| deployment.probes.livenessProbe.initialDelaySeconds | int | `10` |  |
| deployment.probes.livenessProbe.periodSeconds | int | `10` |  |
| deployment.probes.livenessProbe.successThreshold | int | `1` |  |
| deployment.probes.livenessProbe.timeoutSeconds | int | `5` |  |
| deployment.probes.readinessProbe.failureThreshold | int | `5` |  |
| deployment.probes.readinessProbe.httpGet.path | string | `"/health"` |  |
| deployment.probes.readinessProbe.httpGet.port | int | `3000` |  |
| deployment.probes.readinessProbe.initialDelaySeconds | int | `10` |  |
| deployment.probes.readinessProbe.periodSeconds | int | `10` |  |
| deployment.probes.readinessProbe.successThreshold | int | `1` |  |
| deployment.probes.readinessProbe.timeoutSeconds | int | `5` |  |
| deployment.probes.startupProbe.failureThreshold | int | `30` |  |
| deployment.probes.startupProbe.periodSeconds | int | `10` |  |
| deployment.probes.startupProbe.tcpSocket.port | int | `3000` |  |
| deployment.reloadOnChange | bool | `false` |  |
| deployment.replicas | int | `1` |  |
| deployment.resources.limits.memory | string | `"1Gi"` |  |
| deployment.resources.requests.cpu | string | `"500m"` |  |
| deployment.resources.requests.memory | string | `"512Mi"` |  |
| deployment.revisionHistoryLimit | int | `2` |  |
| deployment.securityContext | object | `{}` |  |
| deployment.strategy.type | string | `"RollingUpdate"` |  |
| deployment.tolerations | list | `[]` |  |
| deployment.topologySpreadConstraints | list | `[]` |  |
| enterprise.licenseKey | string | `""` |  |
| externalSecret.enabled | bool | `false` |  |
| externalSecret.files.app-secrets.data.CRON_SECRET.remoteRef.key | string | `"prod/formbricks/secrets"` |  |
| externalSecret.files.app-secrets.data.CRON_SECRET.remoteRef.property | string | `"CRON_SECRET"` |  |
| externalSecret.files.app-secrets.data.DATABASE_URL.remoteRef.key | string | `"prod/formbricks/secrets"` |  |
| externalSecret.files.app-secrets.data.DATABASE_URL.remoteRef.property | string | `"DATABASE_URL"` |  |
| externalSecret.files.app-secrets.data.ENCRYPTION_KEY.remoteRef.key | string | `"prod/formbricks/secrets"` |  |
| externalSecret.files.app-secrets.data.ENCRYPTION_KEY.remoteRef.property | string | `"ENCRYPTION_KEY"` |  |
| externalSecret.files.app-secrets.data.NEXTAUTH_SECRET.remoteRef.key | string | `"prod/formbricks/secrets"` |  |
| externalSecret.files.app-secrets.data.NEXTAUTH_SECRET.remoteRef.property | string | `"NEXTAUTH_SECRET"` |  |
| externalSecret.files.app-secrets.data.REDIS_URL.remoteRef.key | string | `"prod/formbricks/secrets"` |  |
| externalSecret.files.app-secrets.data.REDIS_URL.remoteRef.property | string | `"REDIS_URL"` |  |
| externalSecret.files.postgres.data.POSTGRES_ADMIN_PASSWORD.remoteRef.key | string | `"prod/formbricks/secrets"` |  |
| externalSecret.files.postgres.data.POSTGRES_ADMIN_PASSWORD.remoteRef.property | string | `"POSTGRES_ADMIN_PASSWORD"` |  |
| externalSecret.files.postgres.data.POSTGRES_USER_PASSWORD.remoteRef.key | string | `"prod/formbricks/secrets"` |  |
| externalSecret.files.postgres.data.POSTGRES_USER_PASSWORD.remoteRef.property | string | `"POSTGRES_USER_PASSWORD"` |  |
| externalSecret.files.redis.data.REDIS_PASSWORD.remoteRef.key | string | `"prod/formbricks/secrets"` |  |
| externalSecret.files.redis.data.REDIS_PASSWORD.remoteRef.property | string | `"REDIS_PASSWORD"` |  |
| externalSecret.refreshInterval | string | `"1h"` |  |
| externalSecret.secretStore.kind | string | `"ClusterSecretStore"` |  |
| externalSecret.secretStore.name | string | `"aws-secrets-manager"` |  |
| ingress.annotations | object | `{}` |  |
| ingress.enabled | bool | `false` |  |
| ingress.hosts[0].host | string | `"k8s.formbricks.com"` |  |
| ingress.hosts[0].paths[0].path | string | `"/"` |  |
| ingress.hosts[0].paths[0].pathType | string | `"Prefix"` |  |
| ingress.hosts[0].paths[0].serviceName | string | `"formbricks"` |  |
| ingress.ingressClassName | string | `"alb"` |  |
| nameOverride | string | `""` |  |
| partOfOverride | string | `""` |  |
| postgresql.auth.database | string | `"formbricks"` |  |
| postgresql.auth.existingSecret | string | `"formbricks-postgres"` |  |
| postgresql.auth.secretKeys.adminPasswordKey | string | `"POSTGRES_ADMIN_PASSWORD"` |  |
| postgresql.auth.secretKeys.userPasswordKey | string | `"POSTGRES_USER_PASSWORD"` |  |
| postgresql.auth.username | string | `"formbricks"` |  |
| postgresql.enabled | bool | `true` |  |
| postgresql.externalDatabaseUrl | string | `""` |  |
| postgresql.fullnameOverride | string | `"formbricks-postgresql"` |  |
| postgresql.global.security.allowInsecureImages | bool | `true` |  |
| postgresql.image.repository | string | `"pgvector/pgvector"` |  |
| postgresql.image.tag | string | `"0.8.0-pg17"` |  |
| postgresql.primary.containerSecurityContext.enabled | bool | `true` |  |
| postgresql.primary.containerSecurityContext.readOnlyRootFilesystem | bool | `false` |  |
| postgresql.primary.containerSecurityContext.runAsUser | int | `1001` |  |
| postgresql.primary.persistence.enabled | bool | `true` |  |
| postgresql.primary.persistence.size | string | `"10Gi"` |  |
| postgresql.primary.podSecurityContext.enabled | bool | `true` |  |
| postgresql.primary.podSecurityContext.fsGroup | int | `1001` |  |
| postgresql.primary.podSecurityContext.runAsUser | int | `1001` |  |
| rbac.enabled | bool | `false` |  |
| rbac.serviceAccount.additionalLabels | object | `{}` |  |
| rbac.serviceAccount.annotations | object | `{}` |  |
| rbac.serviceAccount.enabled | bool | `false` |  |
| rbac.serviceAccount.name | string | `""` |  |
| redis.architecture | string | `"standalone"` |  |
| redis.auth.enabled | bool | `true` |  |
| redis.auth.existingSecret | string | `"formbricks-redis"` |  |
| redis.auth.existingSecretPasswordKey | string | `"REDIS_PASSWORD"` |  |
| redis.enabled | bool | `true` |  |
| redis.externalRedisUrl | string | `""` |  |
| redis.fullnameOverride | string | `"formbricks-redis"` |  |
| redis.master.persistence.enabled | bool | `true` |  |
| secret.enabled | bool | `true` |  |
| service.additionalLabels | object | `{}` |  |
| service.annotations | object | `{}` |  |
| service.enabled | bool | `true` |  |
| service.ports | list | `[]` |  |
| service.type | string | `"ClusterIP"` |  |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.14.2](https://github.com/norwoodj/helm-docs/releases/v1.14.2)
