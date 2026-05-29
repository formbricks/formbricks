# formbricks

![Version: 0.0.0-dev](https://img.shields.io/badge/Version-0.0.0--dev-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 5.0.2](https://img.shields.io/badge/AppVersion-5.0.2-informational?style=flat-square)

A Helm chart for Formbricks with PostgreSQL, Valkey

**Homepage:** <https://formbricks.com/docs/self-hosting/setup/kubernetes>

## Maintainers

| Name       | Email                 | Url |
| ---------- | --------------------- | --- |
| Formbricks | <info@formbricks.com> |     |

## Requirements

| Repository                               | Name         | Version |
| ---------------------------------------- | ------------ | ------- |
| oci://registry-1.docker.io/bitnamicharts | postgresql   | 16.4.16 |
| oci://docker.io/envoyproxy               | gateway-helm | v1.7.1  |
| oci://registry-1.docker.io/bitnamicharts | envoyRedis   | 20.11.2 |

## Envoy bundle modes

The chart can optionally deploy Formbricks behind Envoy Gateway with a dedicated Redis HA backend for Envoy global
rate limiting.

- `envoy.enabled=true` enables the app-bound Envoy resources such as `Gateway`, `HTTPRoute`, and rate-limit policies.
- `envoy.controller.enabled=true` installs a bundled Envoy Gateway controller with the release.
- `envoy.controller.enabled=false` keeps the chart in external-controller mode and assumes the cluster already has
  Gateway API CRDs plus an Envoy Gateway controller compatible with
  `envoy.config.envoyGateway.gateway.controllerName`.
- `envoyRedis.enabled=true` deploys a dedicated Redis replication + Sentinel bundle for Envoy RLS. It is intentionally
  separate from the bundled app Valkey deployment.
- The bundled controller reads its Redis backend from `envoy.config.envoyGateway.rateLimit.backend.redis.url`.
  If you enable Redis authentication or override `envoyRedis.fullnameOverride`, set that URL explicitly so the
  controller points at the correct backend.
- OpenTelemetry proxy metrics can target either `envoy.formbricks.proxy.telemetry.openTelemetry.host`/`port`
  or `backendRefs`, but not both. Prefer `host`/`port` for collectors that live in another namespace.
- When both the main app ingress and the Envoy API ingress are enabled, set `envoy.formbricks.ingress.host`
  explicitly so the Envoy host choice is intentional.

The intended defaults are:

- self-hosted / single-tenant clusters: bundled controller mode
- shared clusters with an existing platform controller: external-controller mode

## Cube

Cube is part of the baseline Formbricks v5 stack and is deployed by this chart by default
(`cube.enabled: true`).

- For the chart-managed Cube, the chart renders `deployment.env.CUBEJS_API_URL` automatically as
  `http://formbricks-cube:4000` when using the default release name.
- For an external Cube, set `cube.enabled: false` and point `deployment.env.CUBEJS_API_URL` at your
  endpoint.
- Cube listens on `cube.port`; the chart renders this as an explicit `PORT` env var so values from shared
  app secrets cannot override the listener port.
- The generated app secret supplies `CUBEJS_API_SECRET` by default. If you disable generated secrets,
  provide it through your existing secret management flow.
- Provide `CUBEJS_DB_*` connection variables to the Cube deployment through `cube.envFrom` or `cube.env`.
- Keep `cube.replicas=1` while `cube.env.CUBEJS_CACHE_AND_QUEUE_DRIVER` is `memory`. Configure Cube Store before running multiple Cube replicas.
- Keep Hub enabled. Cube should point at the same feedback records database that Hub writes to, unless you intentionally split that storage.

## Hub worker and self-hosted embeddings

The chart deploys Hub API and, by default, a `hub-worker` deployment. Hub API is insert-only for River jobs; webhook dispatch and embedding jobs are processed by `hub-worker`.

When the Formbricks migration job is enabled, Hub waits for the `formbricks-migration` Job to complete before its own goose/river init migrations run. This keeps fresh shared-database installs from creating Hub tables before Prisma has initialized the Formbricks schema.
If the Job has already been cleaned up, Hub only continues after all expected Prisma and data migration success markers are present in the database.

Self-hosted embeddings are disabled by default. Set `hub.embeddings.enabled=true` to deploy an internal Hugging Face Text Embeddings Inference (TEI) service and wire Hub API plus Hub worker to it through the OpenAI-compatible endpoint added in Hub:

```yaml
hub:
  worker:
    enabled: true

  embeddings:
    enabled: true
    model: Alibaba-NLP/gte-multilingual-base
    servedModelName: Alibaba-NLP/gte-multilingual-base
```

The generated Hub embedding configuration is:

- `EMBEDDING_PROVIDER=openai`
- `EMBEDDING_MODEL=<hub.embeddings.servedModelName or hub.embeddings.model>`
- `EMBEDDING_BASE_URL=http://<release>-hub-embeddings:8080/v1`
- `EMBEDDING_PROVIDER_API_KEY` from a dedicated embeddings Secret

The TEI service is internal-only (`ClusterIP`) and not exposed through ingress. For private or gated models, provide `hub.embeddings.huggingFace.token` or set `hub.embeddings.huggingFace.existingSecret`.

When TEI auth is enabled, configure the shared key through `hub.embeddings.auth.apiKey` or `hub.embeddings.auth.existingSecret`; the chart manages both TEI `API_KEY` and Hub `EMBEDDING_PROVIDER_API_KEY` from that source.

Autoscaling is opt-in for Hub API, Hub worker, and the embeddings runtime. If you scale the embeddings runtime above one replica while persistence is enabled, the cache PVC must support `ReadWriteMany`; otherwise set `hub.embeddings.persistence.enabled=false` or provide a compatible `existingClaim`.

## Values

| Key                                                                | Type   | Default                                                                     | Description                                               |
| ------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| autoscaling.additionalLabels                                       | object | `{}`                                                                        |                                                           |
| autoscaling.annotations                                            | object | `{}`                                                                        |                                                           |
| autoscaling.behavior.scaleDown.policies[0].periodSeconds           | int    | `120`                                                                       |                                                           |
| autoscaling.behavior.scaleDown.policies[0].type                    | string | `"Pods"`                                                                    |                                                           |
| autoscaling.behavior.scaleDown.policies[0].value                   | int    | `1`                                                                         |                                                           |
| autoscaling.behavior.scaleDown.stabilizationWindowSeconds          | int    | `300`                                                                       |                                                           |
| autoscaling.behavior.scaleUp.policies[0].periodSeconds             | int    | `60`                                                                        |                                                           |
| autoscaling.behavior.scaleUp.policies[0].type                      | string | `"Pods"`                                                                    |                                                           |
| autoscaling.behavior.scaleUp.policies[0].value                     | int    | `2`                                                                         |                                                           |
| autoscaling.behavior.scaleUp.stabilizationWindowSeconds            | int    | `60`                                                                        |                                                           |
| autoscaling.enabled                                                | bool   | `true`                                                                      |                                                           |
| autoscaling.maxReplicas                                            | int    | `10`                                                                        |                                                           |
| autoscaling.metrics[0].resource.name                               | string | `"cpu"`                                                                     |                                                           |
| autoscaling.metrics[0].resource.target.averageUtilization          | int    | `60`                                                                        |                                                           |
| autoscaling.metrics[0].resource.target.type                        | string | `"Utilization"`                                                             |                                                           |
| autoscaling.metrics[0].type                                        | string | `"Resource"`                                                                |                                                           |
| autoscaling.metrics[1].resource.name                               | string | `"memory"`                                                                  |                                                           |
| autoscaling.metrics[1].resource.target.averageUtilization          | int    | `60`                                                                        |                                                           |
| autoscaling.metrics[1].resource.target.type                        | string | `"Utilization"`                                                             |                                                           |
| autoscaling.metrics[1].type                                        | string | `"Resource"`                                                                |                                                           |
| autoscaling.minReplicas                                            | int    | `1`                                                                         |                                                           |
| componentOverride                                                  | string | `""`                                                                        |                                                           |
| deployment.additionalLabels                                        | object | `{}`                                                                        |                                                           |
| deployment.additionalPodAnnotations                                | object | `{}`                                                                        |                                                           |
| deployment.additionalPodLabels                                     | object | `{}`                                                                        |                                                           |
| deployment.affinity                                                | object | `{}`                                                                        |                                                           |
| deployment.annotations                                             | object | `{}`                                                                        |                                                           |
| deployment.args                                                    | list   | `[]`                                                                        |                                                           |
| deployment.command                                                 | list   | `[]`                                                                        |                                                           |
| deployment.containerSecurityContext.readOnlyRootFilesystem         | bool   | `true`                                                                      |                                                           |
| deployment.containerSecurityContext.runAsNonRoot                   | bool   | `true`                                                                      |                                                           |
| deployment.env                                                     | object | `{}`                                                                        |                                                           |
| deployment.envFrom                                                 | string | `nil`                                                                       |                                                           |
| deployment.image.digest                                            | string | `""`                                                                        | When set, takes precedence over tag.                      |
| deployment.image.pullPolicy                                        | string | `"IfNotPresent"`                                                            |                                                           |
| deployment.image.repository                                        | string | `"ghcr.io/formbricks/formbricks"`                                           |                                                           |
| deployment.image.tag                                               | string | `""`                                                                        |                                                           |
| deployment.imagePullSecrets                                        | string | `""`                                                                        |                                                           |
| deployment.nodeSelector                                            | object | `{}`                                                                        |                                                           |
| deployment.ports.http.containerPort                                | int    | `3000`                                                                      |                                                           |
| deployment.ports.http.exposed                                      | bool   | `true`                                                                      |                                                           |
| deployment.ports.http.protocol                                     | string | `"TCP"`                                                                     |                                                           |
| deployment.ports.metrics.containerPort                             | int    | `9464`                                                                      |                                                           |
| deployment.ports.metrics.exposed                                   | bool   | `true`                                                                      |                                                           |
| deployment.ports.metrics.protocol                                  | string | `"TCP"`                                                                     |                                                           |
| deployment.probes.livenessProbe.failureThreshold                   | int    | `5`                                                                         |                                                           |
| deployment.probes.livenessProbe.httpGet.path                       | string | `"/health"`                                                                 |                                                           |
| deployment.probes.livenessProbe.httpGet.port                       | int    | `3000`                                                                      |                                                           |
| deployment.probes.livenessProbe.initialDelaySeconds                | int    | `10`                                                                        |                                                           |
| deployment.probes.livenessProbe.periodSeconds                      | int    | `10`                                                                        |                                                           |
| deployment.probes.livenessProbe.successThreshold                   | int    | `1`                                                                         |                                                           |
| deployment.probes.livenessProbe.timeoutSeconds                     | int    | `5`                                                                         |                                                           |
| deployment.probes.readinessProbe.failureThreshold                  | int    | `5`                                                                         |                                                           |
| deployment.probes.readinessProbe.httpGet.path                      | string | `"/health"`                                                                 |                                                           |
| deployment.probes.readinessProbe.httpGet.port                      | int    | `3000`                                                                      |                                                           |
| deployment.probes.readinessProbe.initialDelaySeconds               | int    | `10`                                                                        |                                                           |
| deployment.probes.readinessProbe.periodSeconds                     | int    | `10`                                                                        |                                                           |
| deployment.probes.readinessProbe.successThreshold                  | int    | `1`                                                                         |                                                           |
| deployment.probes.readinessProbe.timeoutSeconds                    | int    | `5`                                                                         |                                                           |
| deployment.probes.startupProbe.failureThreshold                    | int    | `30`                                                                        |                                                           |
| deployment.probes.startupProbe.periodSeconds                       | int    | `10`                                                                        |                                                           |
| deployment.probes.startupProbe.tcpSocket.port                      | int    | `3000`                                                                      |                                                           |
| deployment.reloadOnChange                                          | bool   | `false`                                                                     |                                                           |
| deployment.replicas                                                | int    | `1`                                                                         |                                                           |
| deployment.resources.limits.memory                                 | string | `"2Gi"`                                                                     |                                                           |
| deployment.resources.requests.cpu                                  | string | `"1"`                                                                       |                                                           |
| deployment.resources.requests.memory                               | string | `"1Gi"`                                                                     |                                                           |
| deployment.revisionHistoryLimit                                    | int    | `2`                                                                         |                                                           |
| deployment.securityContext                                         | object | `{}`                                                                        |                                                           |
| deployment.strategy.type                                           | string | `"RollingUpdate"`                                                           |                                                           |
| deployment.tolerations                                             | list   | `[]`                                                                        |                                                           |
| deployment.topologySpreadConstraints                               | list   | `[]`                                                                        |                                                           |
| enterprise.enabled                                                 | bool   | `false`                                                                     |                                                           |
| enterprise.licenseKey                                              | string | `""`                                                                        |                                                           |
| externalSecret.enabled                                             | bool   | `false`                                                                     |                                                           |
| externalSecret.files                                               | object | `{}`                                                                        |                                                           |
| externalSecret.refreshInterval                                     | string | `"1h"`                                                                      |                                                           |
| externalSecret.secretStore.kind                                    | string | `"ClusterSecretStore"`                                                      |                                                           |
| externalSecret.secretStore.name                                    | string | `"aws-secrets-manager"`                                                     |                                                           |
| formbricks.publicUrl                                               | string | `""`                                                                        |                                                           |
| formbricks.webappUrl                                               | string | `""`                                                                        |                                                           |
| hub.autoscaling.enabled                                            | bool   | `false`                                                                     |                                                           |
| hub.autoscaling.maxReplicas                                        | int    | `3`                                                                         |                                                           |
| hub.autoscaling.minReplicas                                        | int    | `1`                                                                         |                                                           |
| hub.enabled                                                        | bool   | `true`                                                                      |                                                           |
| hub.embeddings.auth.enabled                                        | bool   | `true`                                                                      |                                                           |
| hub.embeddings.auth.existingSecret                                 | string | `""`                                                                        |                                                           |
| hub.embeddings.auth.secretKey                                      | string | `"EMBEDDING_PROVIDER_API_KEY"`                                              |                                                           |
| hub.embeddings.autoscaling.enabled                                 | bool   | `false`                                                                     |                                                           |
| hub.embeddings.autoscaling.maxReplicas                             | int    | `2`                                                                         |                                                           |
| hub.embeddings.autoscaling.minReplicas                             | int    | `1`                                                                         |                                                           |
| hub.embeddings.baseUrl                                             | string | `""`                                                                        | Defaults to the internal TEI service URL ending in `/v1`. |
| hub.embeddings.enabled                                             | bool   | `false`                                                                     |                                                           |
| hub.embeddings.extraArgs                                           | list   | `["--dtype","float16"]`                                                     | Additional args appended to the generated TEI args.       |
| hub.embeddings.huggingFace.existingSecret                          | string | `""`                                                                        |                                                           |
| hub.embeddings.huggingFace.token                                   | string | `""`                                                                        |                                                           |
| hub.embeddings.huggingFace.tokenKey                                | string | `"HF_TOKEN"`                                                                |                                                           |
| hub.embeddings.image.pullPolicy                                    | string | `"IfNotPresent"`                                                            |                                                           |
| hub.embeddings.image.repository                                    | string | `"ghcr.io/huggingface/text-embeddings-inference"`                           |                                                           |
| hub.embeddings.image.tag                                           | string | `"cpu-1.9"`                                                                 |                                                           |
| hub.embeddings.maxConcurrent                                       | string | `"5"`                                                                       |                                                           |
| hub.embeddings.model                                               | string | `"Alibaba-NLP/gte-multilingual-base"`                                       |                                                           |
| hub.embeddings.persistence.enabled                                 | bool   | `true`                                                                      |                                                           |
| hub.embeddings.persistence.mountPath                               | string | `"/data"`                                                                   |                                                           |
| hub.embeddings.persistence.size                                    | string | `"10Gi"`                                                                    |                                                           |
| hub.embeddings.pdb.enabled                                         | bool   | `false`                                                                     |                                                           |
| hub.embeddings.port                                                | int    | `8080`                                                                      |                                                           |
| hub.embeddings.prometheusPort                                      | int    | `9000`                                                                      |                                                           |
| hub.embeddings.replicas                                            | int    | `1`                                                                         |                                                           |
| hub.embeddings.resources.limits.memory                             | string | `"8Gi"`                                                                     |                                                           |
| hub.embeddings.resources.requests.cpu                              | string | `"4"`                                                                       |                                                           |
| hub.embeddings.resources.requests.memory                           | string | `"8Gi"`                                                                     |                                                           |
| hub.embeddings.runtime                                             | string | `"tei"`                                                                     |                                                           |
| hub.embeddings.servedModelName                                     | string | `""`                                                                        | Defaults to `hub.embeddings.model`.                       |
| hub.embeddings.service.port                                        | int    | `8080`                                                                      |                                                           |
| hub.embeddings.service.type                                        | string | `"ClusterIP"`                                                               |                                                           |
| hub.env                                                            | object | `{}`                                                                        |                                                           |
| hub.existingSecret                                                 | string | `""`                                                                        |                                                           |
| hub.image.digest                                                   | string | `"sha256:14db7b3d285b6e9165b55693f9b83d08beff840a255fd77dd12882ee0a62f5cb"` | When set, takes precedence over tag (immutable pin).      |
| hub.image.pullPolicy                                               | string | `"IfNotPresent"`                                                            |                                                           |
| hub.image.repository                                               | string | `"ghcr.io/formbricks/hub"`                                                  |                                                           |
| hub.image.tag                                                      | string | `"0.3.0"`                                                                   | Fallback when digest is empty.                            |
| hub.migration.activeDeadlineSeconds                                | int    | `900`                                                                       |                                                           |
| hub.migration.backoffLimit                                         | int    | `3`                                                                         |                                                           |
| hub.migration.ttlSecondsAfterFinished                              | int    | `300`                                                                       |                                                           |
| hub.migration.waitForFormbricksMigration.enabled                   | bool   | `true`                                                                      |                                                           |
| hub.migration.waitForFormbricksMigration.intervalSeconds           | int    | `5`                                                                         |                                                           |
| hub.migration.waitForFormbricksMigration.maxAttempts               | int    | `180`                                                                       |                                                           |
| hub.migration.waitForFormbricksMigration.missingJobMaxAttempts     | int    | `12`                                                                        | Consecutive missing Job reads before using DB markers.    |
| hub.pdb.enabled                                                    | bool   | `false`                                                                     |                                                           |
| hub.replicas                                                       | int    | `1`                                                                         |                                                           |
| hub.resources.limits.memory                                        | string | `"512Mi"`                                                                   |                                                           |
| hub.resources.requests.cpu                                         | string | `"100m"`                                                                    |                                                           |
| hub.resources.requests.memory                                      | string | `"256Mi"`                                                                   |                                                           |
| hub.worker.autoscaling.enabled                                     | bool   | `false`                                                                     |                                                           |
| hub.worker.autoscaling.maxReplicas                                 | int    | `5`                                                                         |                                                           |
| hub.worker.autoscaling.minReplicas                                 | int    | `1`                                                                         |                                                           |
| hub.worker.enabled                                                 | bool   | `true`                                                                      |                                                           |
| hub.worker.env                                                     | object | `{}`                                                                        |                                                           |
| hub.worker.pdb.enabled                                             | bool   | `false`                                                                     |                                                           |
| hub.worker.replicas                                                | int    | `1`                                                                         |                                                           |
| hub.worker.resources.limits.memory                                 | string | `"512Mi"`                                                                   |                                                           |
| hub.worker.resources.requests.cpu                                  | string | `"100m"`                                                                    |                                                           |
| hub.worker.resources.requests.memory                               | string | `"256Mi"`                                                                   |                                                           |
| hub.worker.waitForApi.enabled                                      | bool   | `true`                                                                      |                                                           |
| hub.worker.waitForApi.maxAttempts                                  | int    | `120`                                                                       | 120 attempts at 5s intervals = 10 minutes.                |
| ingress.annotations                                                | object | `{}`                                                                        |                                                           |
| ingress.enabled                                                    | bool   | `false`                                                                     |                                                           |
| ingress.hosts[0].host                                              | string | `"k8s.formbricks.com"`                                                      |                                                           |
| ingress.hosts[0].paths[0].path                                     | string | `"/"`                                                                       |                                                           |
| ingress.hosts[0].paths[0].pathType                                 | string | `"Prefix"`                                                                  |                                                           |
| ingress.hosts[0].paths[0].serviceName                              | string | `"formbricks"`                                                              |                                                           |
| ingress.ingressClassName                                           | string | `"alb"`                                                                     |                                                           |
| migration.annotations                                              | object | `{}`                                                                        |                                                           |
| migration.backoffLimit                                             | int    | `3`                                                                         |                                                           |
| migration.enabled                                                  | bool   | `true`                                                                      |                                                           |
| migration.resources.limits.memory                                  | string | `"512Mi"`                                                                   |                                                           |
| migration.resources.requests.cpu                                   | string | `"100m"`                                                                    |                                                           |
| migration.resources.requests.memory                                | string | `"256Mi"`                                                                   |                                                           |
| migration.ttlSecondsAfterFinished                                  | int    | `300`                                                                       |                                                           |
| nameOverride                                                       | string | `""`                                                                        |                                                           |
| partOfOverride                                                     | string | `""`                                                                        |                                                           |
| pdb.additionalLabels                                               | object | `{}`                                                                        |                                                           |
| pdb.annotations                                                    | object | `{}`                                                                        |                                                           |
| pdb.enabled                                                        | bool   | `true`                                                                      |                                                           |
| pdb.minAvailable                                                   | int    | `1`                                                                         |                                                           |
| postgresql.auth.database                                           | string | `"formbricks"`                                                              |                                                           |
| postgresql.auth.existingSecret                                     | string | `"formbricks-app-secrets"`                                                  |                                                           |
| postgresql.auth.secretKeys.adminPasswordKey                        | string | `"POSTGRES_ADMIN_PASSWORD"`                                                 |                                                           |
| postgresql.auth.secretKeys.userPasswordKey                         | string | `"POSTGRES_USER_PASSWORD"`                                                  |                                                           |
| postgresql.auth.username                                           | string | `"formbricks"`                                                              |                                                           |
| postgresql.enabled                                                 | bool   | `true`                                                                      |                                                           |
| postgresql.externalDatabaseUrl                                     | string | `""`                                                                        |                                                           |
| postgresql.fullnameOverride                                        | string | `"formbricks-postgresql"`                                                   |                                                           |
| postgresql.global.security.allowInsecureImages                     | bool   | `true`                                                                      |                                                           |
| postgresql.image.repository                                        | string | `"pgvector/pgvector"`                                                       |                                                           |
| postgresql.image.tag                                               | string | `"pg17"`                                                                    |                                                           |
| postgresql.primary.containerSecurityContext.enabled                | bool   | `true`                                                                      |                                                           |
| postgresql.primary.containerSecurityContext.readOnlyRootFilesystem | bool   | `false`                                                                     |                                                           |
| postgresql.primary.containerSecurityContext.runAsUser              | int    | `1001`                                                                      |                                                           |
| postgresql.primary.networkPolicy.enabled                           | bool   | `false`                                                                     |                                                           |
| postgresql.primary.persistence.enabled                             | bool   | `true`                                                                      |                                                           |
| postgresql.primary.persistence.size                                | string | `"10Gi"`                                                                    |                                                           |
| postgresql.primary.podSecurityContext.enabled                      | bool   | `true`                                                                      |                                                           |
| postgresql.primary.podSecurityContext.fsGroup                      | int    | `1001`                                                                      |                                                           |
| postgresql.primary.podSecurityContext.runAsUser                    | int    | `1001`                                                                      |                                                           |
| rbac.enabled                                                       | bool   | `false`                                                                     |                                                           |
| rbac.serviceAccount.additionalLabels                               | object | `{}`                                                                        |                                                           |
| rbac.serviceAccount.annotations                                    | object | `{}`                                                                        |                                                           |
| rbac.serviceAccount.enabled                                        | bool   | `false`                                                                     |                                                           |
| rbac.serviceAccount.name                                           | string | `""`                                                                        |                                                           |
| redis.architecture                                                 | string | `"standalone"`                                                              |                                                           |
| redis.auth.enabled                                                 | bool   | `true`                                                                      |                                                           |
| redis.auth.existingSecret                                          | string | `"formbricks-app-secrets"`                                                  |                                                           |
| redis.auth.existingSecretPasswordKey                               | string | `"REDIS_PASSWORD"`                                                          |                                                           |
| redis.enabled                                                      | bool   | `true`                                                                      |                                                           |
| redis.externalRedisUrl                                             | string | `""`                                                                        |                                                           |
| redis.fullnameOverride                                             | string | `"formbricks-redis"`                                                        |                                                           |
| redis.image.digest                                                 | string | `"sha256:12ba4f45a7c3e1d0f076acd616cb230834e75a77e8516dde382720af32832d6d"` |                                                           |
| redis.image.pullPolicy                                             | string | `"IfNotPresent"`                                                            |                                                           |
| redis.image.repository                                             | string | `"valkey/valkey"`                                                           |                                                           |
| redis.image.tag                                                    | string | `""`                                                                        |                                                           |
| redis.master.affinity                                              | object | `{}`                                                                        |                                                           |
| redis.master.containerSecurityContext                              | object | `{}`                                                                        |                                                           |
| redis.master.nodeSelector                                          | object | `{}`                                                                        |                                                           |
| redis.master.pdb.enabled                                           | bool   | `true`                                                                      |                                                           |
| redis.master.pdb.maxUnavailable                                    | int    | `0`                                                                         |                                                           |
| redis.master.pdb.minAvailable                                      | string | `""`                                                                        |                                                           |
| redis.master.persistence.accessModes[0]                            | string | `"ReadWriteOnce"`                                                           |                                                           |
| redis.master.persistence.enabled                                   | bool   | `true`                                                                      |                                                           |
| redis.master.persistence.size                                      | string | `"8Gi"`                                                                     |                                                           |
| redis.master.persistence.storageClass                              | string | `""`                                                                        |                                                           |
| redis.master.podAnnotations                                        | object | `{}`                                                                        |                                                           |
| redis.master.podSecurityContext                                    | object | `{}`                                                                        |                                                           |
| redis.master.resources.limits.cpu                                  | string | `"150m"`                                                                    |                                                           |
| redis.master.resources.limits.memory                               | string | `"192Mi"`                                                                   |                                                           |
| redis.master.resources.requests.cpu                                | string | `"100m"`                                                                    |                                                           |
| redis.master.resources.requests.memory                             | string | `"128Mi"`                                                                   |                                                           |
| redis.master.tolerations                                           | list   | `[]`                                                                        |                                                           |
| redis.master.topologySpreadConstraints                             | list   | `[]`                                                                        |                                                           |
| redis.networkPolicy.enabled                                        | bool   | `false`                                                                     |                                                           |
| secret.enabled                                                     | bool   | `true`                                                                      |                                                           |
| service.additionalLabels                                           | object | `{}`                                                                        |                                                           |
| service.annotations                                                | object | `{}`                                                                        |                                                           |
| service.enabled                                                    | bool   | `true`                                                                      |                                                           |
| service.ports                                                      | list   | `[]`                                                                        |                                                           |
| service.type                                                       | string | `"ClusterIP"`                                                               |                                                           |
| serviceMonitor.additionalLabels                                    | string | `nil`                                                                       |                                                           |
| serviceMonitor.annotations                                         | string | `nil`                                                                       |                                                           |
| serviceMonitor.enabled                                             | bool   | `true`                                                                      |                                                           |
| serviceMonitor.endpoints[0].interval                               | string | `"5s"`                                                                      |                                                           |
| serviceMonitor.endpoints[0].path                                   | string | `"/metrics"`                                                                |                                                           |
| serviceMonitor.endpoints[0].port                                   | string | `"metrics"`                                                                 |                                                           |
