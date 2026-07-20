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
| file://../spicedb-operator               | spicedbOperator | 0.1.0 |
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

## AuthZed / SpiceDB

AuthZed is disabled by default. To deploy SpiceDB with Formbricks and the bundled PostgreSQL chart:

```yaml
authzed:
  enabled: true
  operator:
    install: true
```

This installs the pinned SpiceDB operator, creates a two-replica `SpiceDBCluster`, generates a stable preshared
key, and creates a dedicated `spicedb` database and role in the bundled PostgreSQL server. The operator runs
datastore migrations before rolling out SpiceDB. The chart assigns explicit resource requests and limits to
SpiceDB and uses a larger PostgreSQL allocation than the upstream `nano` preset so the database has enough
headroom during SpiceDB rollouts. Override `authzed.cluster.resources` and `postgresql.primary.resources` to
match the expected authorization traffic and the other workloads using the bundled database.

Install only one operator per Kubernetes cluster. When a platform-managed operator already watches the Formbricks
namespace, keep `authzed.operator.install=false`; the Formbricks release still owns its `SpiceDBCluster`.
Kubernetes does not upgrade CRDs during a normal Helm upgrade. When changing the bundled operator version, apply
the matching `charts/spicedb-operator/crds/authzed.com_spicedbclusters.yaml` before upgrading the release.

For managed PostgreSQL, create a dedicated database and login outside Helm and expose these keys in a Kubernetes
Secret:

```yaml
stringData:
  datastore_uri: postgresql://spicedb:<password>@postgres.example:5432/spicedb?sslmode=require
  preshared_key: <strong-random-token>
```

Then reference it from the release:

```yaml
authzed:
  enabled: true
  mode: selfHosted
  auth:
    existingSecret: formbricks-authzed
  datastore:
    existingSecret: formbricks-authzed
```

To connect to an AuthZed-managed or otherwise external endpoint, set `authzed.mode=external`, provide
`authzed.endpoint`, and reference a Secret containing `preshared_key`. The chart injects `AUTHZED_ENABLED`,
`AUTHZED_ENDPOINT`, `AUTHZED_TOKEN`, `AUTHZED_SYSTEM_KEY`, `AUTHZED_INSECURE`, and `AUTHZED_CONSISTENCY` into
the Formbricks app. Authorization checks must fail closed once product enforcement is enabled; general
Formbricks readiness remains independent from transient SpiceDB availability.

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

When deployed with Argo CD, chart-managed Secrets and ExternalSecrets render in sync wave `-2`, and the Formbricks and Hub migration hooks run in sync wave `-1`. This lets app and Hub secrets exist before migration jobs start.

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

Configure Hub enrichment providers through `hub.env`. API-key providers can keep their secrets in
`hub.existingSecret`. Providers that need credential files, custom CA bundles, or other pod-level
configuration can use the provider-neutral `hub.extraVolumes` and `hub.extraVolumeMounts`
settings, which apply to both Hub API and hub-worker.

For example, a Vertex AI deployment can mount an existing Google credential JSON Secret and point
Application Default Credentials at it:

```yaml
hub:
  extraVolumes:
    - name: google-cloud-credentials
      secret:
        secretName: formbricks-app-secrets
        items:
          - key: GOOGLE_APPLICATION_CREDENTIALS_JSON
            path: credentials.json

  extraVolumeMounts:
    - name: google-cloud-credentials
      mountPath: /var/run/secrets/formbricks/google
      readOnly: true

  env:
    GOOGLE_APPLICATION_CREDENTIALS: /var/run/secrets/formbricks/google/credentials.json
    SENTIMENT_PROVIDER: google-gemini
    SENTIMENT_MODEL: gemini-2.5-flash
    SENTIMENT_GOOGLE_CLOUD_PROJECT: your-google-cloud-project
    SENTIMENT_GOOGLE_CLOUD_LOCATION: global
```

The chart renders these additions unchanged into both Hub processes. Keep credential values out of
values files and reference existing Kubernetes Secrets instead.

Autoscaling is opt-in for Hub API, Hub worker, and the embeddings runtime. If you scale the embeddings runtime above one replica while persistence is enabled, the cache PVC must support `ReadWriteMany`; otherwise set `hub.embeddings.persistence.enabled=false` or provide a compatible `existingClaim`.

## Web AI with self-hosted Qwen/vLLM

The chart can optionally deploy a Formbricks-provided Qwen runtime through the `vllm-stack` dependency. It is disabled by default so existing installs keep using their current AI provider settings.

To deploy the bundled Qwen/vLLM runtime and automatically point the Formbricks app at it:

```yaml
llm:
  enabled: true
```

This renders the vLLM router and Qwen serving engine, then injects these app env vars unless you override them in `deployment.env`:

```yaml
AI_PROVIDER: openai-compatible
AI_MODEL: qwen3-14b-awq
AI_OPENAI_COMPATIBLE_BASE_URL: http://<release-name>-router-service:8000/v1
AI_OPENAI_COMPATIBLE_PROVIDER_NAME: vllm
AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS: "1"
```

Set `llm.autoConfigureApp=false` to deploy the bundled runtime without injecting Formbricks app AI env vars.

If you manage your own LLM runtime, keep `llm.enabled=false` and point the web app at your OpenAI-compatible `/v1` endpoint through `deployment.env`.

Only set these variables when you use `AI_PROVIDER=openai-compatible`; Google Vertex, AWS Bedrock, and Azure continue to use their own provider-specific variables.

```yaml
deployment:
  env:
    AI_PROVIDER: openai-compatible
    AI_MODEL: qwen3-14b-awq
    AI_OPENAI_COMPATIBLE_BASE_URL: http://vllm:8000/v1
    AI_OPENAI_COMPATIBLE_PROVIDER_NAME: vllm
    AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS: "1"
    AI_OPENAI_COMPATIBLE_API_KEY:
      valueFrom:
        secretKeyRef:
          name: formbricks-ai-secrets
          key: AI_OPENAI_COMPATIBLE_API_KEY
```

Optional JSON fields such as `AI_OPENAI_COMPATIBLE_HEADERS_JSON` and `AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON` can use the same `valueFrom.secretKeyRef` pattern. If you use External Secrets, render a dedicated Secret and reference it from `deployment.env`:

```yaml
externalSecret:
  enabled: true
  files:
    ai-secrets:
      data:
        AI_OPENAI_COMPATIBLE_API_KEY:
          remoteRef:
            key: formbricks/qwen-vllm
            property: apiKey
```

## AI Taxonomy Beta

The chart can optionally deploy the standalone AI taxonomy service. It is disabled by default and remains internal
to the cluster through a `ClusterIP` service.

To deploy taxonomy and reuse the bundled Qwen/vLLM runtime:

```yaml
llm:
  enabled: true

taxonomy:
  enabled: true
```

When `taxonomy.enabled=true`, the chart creates the taxonomy Deployment, Service, and Secret, then injects these
Hub API env vars unless `taxonomy.autoConfigureHub=false`:

```yaml
TAXONOMY_SERVICE_URL: http://formbricks-taxonomy:8000
TAXONOMY_SERVICE_TOKEN: <from taxonomy auth secret>
HUB_INTERNAL_API_TOKEN: <from taxonomy auth secret>
```

If `llm.enabled=true` and `taxonomy.llm.baseUrl` is empty, taxonomy uses the bundled vLLM router at
`http://<release-name>-router-service:8000/v1`. To use an external OpenAI-compatible LLM instead:

```yaml
taxonomy:
  enabled: true
  llm:
    model: qwen3-14b-awq
    baseUrl: http://my-llm-gateway:8000/v1
    existingSecret: taxonomy-llm-secret
```

The taxonomy service exposes public `/health` only for Kubernetes probes. Use authenticated `/v1/preflight` as an
operator check after install:

```sh
kubectl exec -n formbricks deploy/formbricks-taxonomy -- \
  python -c 'import os, urllib.request; req = urllib.request.Request("http://127.0.0.1:8000/v1/preflight", headers={"Authorization": "Bearer " + os.environ["TAXONOMY_SERVICE_TOKEN"]}); print(urllib.request.urlopen(req, timeout=10).read().decode())'
```

To use Gemini on Vertex AI instead of an OpenAI-compatible endpoint:

```yaml
taxonomy:
  enabled: true
  llm:
    provider: vertex-gemini
    model: gemini-2.5-flash
    vertex:
      project: formbricks-cloud
      location: europe-west3
      existingSecret: taxonomy-vertex-secret
```

The `taxonomy-vertex-secret` secret must contain `TAXONOMY_GOOGLE_CLOUD_CREDENTIALS_JSON` with service-account
JSON that can call Vertex AI.

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
| deployment.env                                                     | object | `{}`                                                                        | App container environment variables. Supports scalar values and `valueFrom` maps such as `secretKeyRef`. |
| deployment.envFrom                                                 | string | `nil`                                                                       | Additional app container environment sources from ConfigMaps or Secrets. |
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
| hub.extraVolumeMounts                                              | list   | `[]`                                                                        | Additional volume mounts for Hub API and worker.          |
| hub.extraVolumes                                                   | list   | `[]`                                                                        | Additional pod volumes for Hub API and worker.            |
| hub.image.digest                                                   | string | `"sha256:5d7e7c6138ff77984db54b7c91693d8f56017cefa74bc69390fc7191403208c5"` | When set, takes precedence over tag (immutable pin).      |
| hub.image.pullPolicy                                               | string | `"IfNotPresent"`                                                            |                                                           |
| hub.image.repository                                               | string | `"ghcr.io/formbricks/hub"`                                                  |                                                           |
| hub.image.tag                                                      | string | `"0.8.1"`                                                                   | Fallback when digest is empty.                            |
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
| llm.autoConfigureApp                                               | bool   | `true`                                                                      | Inject OpenAI-compatible app env vars when bundled Qwen/vLLM is enabled. |
| llm.enabled                                                        | bool   | `false`                                                                     | Deploy bundled Qwen/vLLM through the optional vllm-stack dependency. |
| llm.formbricks.baseUrl                                             | string | `""`                                                                        | Defaults to `http://<release-name>-router-service:<llm.routerSpec.servicePort>/v1`. |
| llm.formbricks.model                                               | string | `"qwen3-14b-awq"`                                                           | Formbricks `AI_MODEL` value for the bundled runtime.      |
| llm.formbricks.providerName                                        | string | `"vllm"`                                                                    | Formbricks OpenAI-compatible provider display name.       |
| llm.formbricks.supportsStructuredOutputs                           | string | `"1"`                                                                       | Enables structured output usage for the bundled runtime.  |
| llm.routerSpec.enableRouter                                        | bool   | `true`                                                                      | Enable the vLLM router service.                           |
| llm.routerSpec.k8sServiceDiscoveryType                             | string | `"service-name"`                                                            | vLLM router Kubernetes service discovery mode.            |
| llm.routerSpec.servicePort                                         | int    | `8000`                                                                      | vLLM router service port used by the app base URL.        |
| llm.routerSpec.serviceType                                         | string | `"ClusterIP"`                                                               | vLLM router service type.                                 |
| llm.servingEngineSpec.enableEngine                                 | bool   | `true`                                                                      | Enable the vLLM serving engine.                           |
| llm.servingEngineSpec.modelSpec[0].modelURL                        | string | `"Qwen/Qwen3-14B-AWQ"`                                                      | Hugging Face model loaded by vLLM.                        |
| llm.servingEngineSpec.modelSpec[0].name                            | string | `"qwen"`                                                                    | vLLM model spec name.                                     |
| llm.servingEngineSpec.modelSpec[0].repository                      | string | `"vllm/vllm-openai"`                                                        | vLLM runtime image repository.                            |
| llm.servingEngineSpec.modelSpec[0].requestGPU                      | int    | `1`                                                                         | GPU request for the Qwen serving pod.                     |
| llm.servingEngineSpec.modelSpec[0].requestGPUType                  | string | `"nvidia.com/gpu"`                                                          | Kubernetes GPU resource key.                              |
| llm.servingEngineSpec.modelSpec[0].tag                             | string | `"v0.14.0"`                                                                 | vLLM runtime image tag.                                   |
| llm.servingEngineSpec.servicePort                                  | int    | `8000`                                                                      | Qwen serving engine service port.                         |
| llm.servingEngineSpec.strategy.type                                | string | `"Recreate"`                                                                | Avoids requiring a second GPU during model pod upgrades.  |
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
| taxonomy.autoConfigureHub                                          | bool   | `true`                                                                      | Inject taxonomy service env vars into Hub API when taxonomy is enabled. |
| taxonomy.enabled                                                   | bool   | `false`                                                                     | Deploy the optional standalone taxonomy service.          |
| taxonomy.image.repository                                          | string | `"ghcr.io/formbricks/taxonomy"`                                             | Taxonomy service image repository.                        |
| taxonomy.image.tag                                                 | string | `"v0.1.0"`                                                                  | Taxonomy service image tag.                               |
| taxonomy.llm.baseUrl                                               | string | `""`                                                                        | Defaults to bundled vLLM router URL when `llm.enabled=true`; set for external LLMs. |
| taxonomy.llm.existingSecret                                        | string | `""`                                                                        | Existing secret containing `TAXONOMY_LLM_API_KEY`.        |
| taxonomy.llm.model                                                 | string | `"qwen3-14b-awq"`                                                           | LLM model used by taxonomy labeling and tree generation.  |
| taxonomy.llm.provider                                              | string | `"openai-compatible"`                                                       | Taxonomy LLM provider.                                    |
| taxonomy.llm.vertex.credentialsJson                                | string | `""`                                                                        | Inline Vertex service-account JSON used only when no existing secret is set. |
| taxonomy.llm.vertex.credentialsJsonSecretKey                       | string | `"TAXONOMY_GOOGLE_CLOUD_CREDENTIALS_JSON"`                                  | Secret key containing Vertex service-account JSON.        |
| taxonomy.llm.vertex.existingSecret                                 | string | `""`                                                                        | Existing secret containing Vertex service-account JSON.   |
| taxonomy.llm.vertex.location                                       | string | `""`                                                                        | Vertex AI location for Gemini taxonomy calls.             |
| taxonomy.llm.vertex.project                                        | string | `""`                                                                        | Google Cloud project for Gemini taxonomy calls.           |
| taxonomy.service.type                                              | string | `"ClusterIP"`                                                               | Internal taxonomy service type.                           |
