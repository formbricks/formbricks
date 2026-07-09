{{/*
Expand the name of the chart.
This function ensures that the chart name is either taken from `nameOverride` or defaults to `.Chart.Name`.
It also truncates the name to a maximum of 63 characters and removes trailing hyphens.
*/}}
{{- define "formbricks.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Hub resource name: base name truncated to 59 chars then "-hub" so the suffix is never lost (63 char limit).
*/}}
{{- define "formbricks.hubname" -}}
{{- $base := include "formbricks.name" . | trunc 59 | trimSuffix "-" }}
{{- printf "%s-hub" $base | trimSuffix "-" }}
{{- end }}

{{/*
Cube.js resource name.
*/}}
{{- define "formbricks.cubeName" -}}
{{- $base := include "formbricks.name" . | trunc 58 | trimSuffix "-" }}
{{- printf "%s-cube" $base | trimSuffix "-" }}
{{- end }}


{{/*
Define the application version to be used in labels.
The version is taken from `.Values.deployment.image.tag` if provided, otherwise it defaults to `.Chart.Version`.
It ensures the version only contains alphanumeric characters, underscores, dots, or hyphens, replacing any invalid characters with a hyphen.
*/}}
{{- define "formbricks.version" -}}
  {{- $appVersion := default .Chart.Version .Values.deployment.image.tag -}}
  {{- regexReplaceAll "[^a-zA-Z0-9_\\.\\-]" $appVersion "-" | trunc 63 | trimSuffix "-" -}}
{{- end }}


{{/*
Generate a chart name and version string to be used in Helm chart labels.
This follows the format: `<ChartName>-<ChartVersion>`, replacing `+` with `_` and truncating to 63 characters.
*/}}
{{- define "formbricks.chart" -}}
  {{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}


{{/*
Common labels applied to Kubernetes resources.
These labels help identify and manage the application.
*/}}
{{- define "formbricks.labels" -}}
helm.sh/chart: {{ include "formbricks.chart" . }}

# Selector labels
{{ include "formbricks.selectorLabels" . }}

# Application version label
{{- with include "formbricks.version" . }}
app.kubernetes.io/version: {{ . | quote }}
{{- end }}

# Managed by Helm
app.kubernetes.io/managed-by: {{ .Release.Service }}

# Part of label, defaults to the chart name if `partOfOverride` is not provided.
app.kubernetes.io/part-of: {{ .Values.partOfOverride | default (include "formbricks.name" .) }}
{{- end }}


{{/*
Selector labels used for identifying workloads in Kubernetes.
These labels ensure that selectors correctly map to the deployed resources.
*/}}
{{- define "formbricks.selectorLabels" -}}
app.kubernetes.io/name: {{ include "formbricks.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ .Values.componentOverride | default (include "formbricks.name" .) }}
{{- end }}


{{/*
Renders a value that contains a Helm template.
Usage:
{{ include "formbricks.tplvalues.render" ( dict "value" .Values.path.to.the.Value "context" $) }}
This function allows rendering values dynamically.
*/}}
{{- define "formbricks.tplvalues.render" -}}
    {{- if typeIs "string" .value }}
        {{- tpl .value .context }}
    {{- else }}
        {{- tpl (.value | toYaml) .context }}
    {{- end }}
{{- end }}

{{/*
Render a Kubernetes EnvVar from chart env maps.
Scalar values become quoted string values. Map values are rendered as EnvVar fields,
which keeps advanced forms such as valueFrom supported.
*/}}
{{- define "formbricks.envVarValue" -}}
{{- $value := .value -}}
{{- if kindIs "map" $value -}}
{{- include "formbricks.tplvalues.render" (dict "value" $value "context" .context) -}}
{{- else if kindIs "invalid" $value -}}
value: ""
{{- else -}}
value: {{ include "formbricks.tplvalues.render" (dict "value" (toString $value) "context" .context) | trim | quote }}
{{- end -}}
{{- end }}

{{- define "formbricks.envVar" -}}
- name: {{ include "formbricks.tplvalues.render" (dict "value" .name "context" .context) }}
  {{- include "formbricks.envVarValue" (dict "value" .value "context" .context) | nindent 2 }}
{{- end }}

{{/*
Default OpenAI-compatible base URL for the bundled vLLM router.
*/}}
{{- define "formbricks.llmBaseUrl" -}}
{{- if .Values.llm.formbricks.baseUrl -}}
{{- include "formbricks.tplvalues.render" (dict "value" .Values.llm.formbricks.baseUrl "context" .) -}}
{{- else -}}
{{- printf "http://%s-router-service:%s/v1" .Release.Name (toString .Values.llm.routerSpec.servicePort) -}}
{{- end -}}
{{- end }}

{{/*
Allow the release namespace to be overridden.
If `namespaceOverride` is provided, it will be used; otherwise, it defaults to `.Release.Namespace`.
*/}}
{{- define "formbricks.namespace" -}}
{{- default .Release.Namespace .Values.namespaceOverride -}}
{{- end -}}

{{- define "formbricks.appSecretName" -}}
{{- printf "%s-app-secrets" (include "formbricks.name" .) -}}
{{- end }}

{{- define "formbricks.redisName" -}}
{{- .Values.redis.fullnameOverride | default (printf "%s-redis" (include "formbricks.name" .)) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "formbricks.redisMasterName" -}}
{{- printf "%s-master" (include "formbricks.redisName" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "formbricks.redisHeadlessName" -}}
{{- printf "%s-headless" (include "formbricks.redisName" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "formbricks.redisImage" -}}
{{- if .Values.redis.image.digest -}}
{{- printf "%s@%s" .Values.redis.image.repository .Values.redis.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.redis.image.repository .Values.redis.image.tag -}}
{{- end -}}
{{- end }}

{{- define "formbricks.redisSecretName" -}}
{{- .Values.redis.auth.existingSecret | default (include "formbricks.appSecretName" .) -}}
{{- end }}

{{- define "formbricks.redisSecretKey" -}}
{{- .Values.redis.auth.existingSecretPasswordKey | default "REDIS_PASSWORD" -}}
{{- end }}

{{- define "formbricks.migrationJobName" -}}
{{- printf "%s-migration" (include "formbricks.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Formbricks application image reference. A configured digest takes precedence over the tag.
*/}}
{{- define "formbricks.deploymentImage" -}}
{{- if .Values.deployment.image.digest -}}
{{- printf "%s@%s" .Values.deployment.image.repository .Values.deployment.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.deployment.image.repository (.Values.deployment.image.tag | default .Chart.AppVersion | default "latest") -}}
{{- end -}}
{{- end }}

{{/*
Image used by the migration Job (ENG-1153). This is the dedicated, Prisma-CLI-
bearing migration image, kept separate so the web runtime image can stay slim.
The web image no longer bundles the Prisma CLI, so this image is required — there
is no safe fallback to the application image (it can't run `prisma migrate deploy`).
`migration.image.repository` therefore must be set (it has a sensible default);
clearing it fails rendering with guidance rather than producing a Job that can't
migrate. A configured digest takes precedence over the tag.
*/}}
{{- define "formbricks.migrationImage" -}}
{{- if not .Values.migration.image.repository -}}
{{- fail "migration.image.repository is required: the web image no longer bundles the Prisma CLI, so the migration Job needs the dedicated migration image. Set migration.image.repository (default ghcr.io/formbricks/formbricks-migrate) or mirror that image into your registry." -}}
{{- end -}}
{{- if .Values.migration.image.digest -}}
{{- printf "%s@%s" .Values.migration.image.repository .Values.migration.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.migration.image.repository (.Values.migration.image.tag | default .Chart.AppVersion | default "latest") -}}
{{- end -}}
{{- end }}

{{- define "formbricks.hubSecretName" -}}
{{- default (include "formbricks.appSecretName" .) .Values.hub.existingSecret -}}
{{- end }}

{{- define "formbricks.hubMigrationWaitServiceAccountName" -}}
{{- printf "%s-migration-wait" (include "formbricks.hubname" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Hub image reference. Pin by digest in production (hub.image.digest = "sha256:..."); falls back to
hub.image.tag for local/dev. All Hub workloads (deployment, init container, migration job, future
hub-worker) must use this helper so they cannot drift apart.
*/}}
{{- define "formbricks.hubImage" -}}
{{- if .Values.hub.image.digest -}}
{{- printf "%s@%s" .Values.hub.image.repository .Values.hub.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.hub.image.repository (.Values.hub.image.tag | default "latest") -}}
{{- end -}}
{{- end }}

{{/*
Hub worker resource name.
*/}}
{{- define "formbricks.hubWorkerName" -}}
{{- $base := include "formbricks.name" . | trunc 52 | trimSuffix "-" }}
{{- printf "%s-hub-worker" $base | trimSuffix "-" }}
{{- end }}

{{/*
Taxonomy service resource name.
*/}}
{{- define "formbricks.taxonomyName" -}}
{{- $base := include "formbricks.name" . | trunc 54 | trimSuffix "-" }}
{{- printf "%s-taxonomy" $base | trimSuffix "-" }}
{{- end }}

{{/*
Taxonomy service image reference. A configured digest takes precedence over the tag.
*/}}
{{- define "formbricks.taxonomyImage" -}}
{{- if .Values.taxonomy.image.digest -}}
{{- printf "%s@%s" .Values.taxonomy.image.repository .Values.taxonomy.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.taxonomy.image.repository (.Values.taxonomy.image.tag | default "latest") -}}
{{- end -}}
{{- end }}

{{- define "formbricks.taxonomyManagedSecretName" -}}
{{- printf "%s-secret" (include "formbricks.taxonomyName" .) -}}
{{- end }}

{{- define "formbricks.taxonomyAuthSecretName" -}}
{{- default (include "formbricks.taxonomyManagedSecretName" .) .Values.taxonomy.auth.existingSecret -}}
{{- end }}

{{- define "formbricks.taxonomyLlmSecretName" -}}
{{- default (include "formbricks.taxonomyManagedSecretName" .) .Values.taxonomy.llm.existingSecret -}}
{{- end }}

{{- define "formbricks.taxonomyVertexSecretName" -}}
{{- default (include "formbricks.taxonomyManagedSecretName" .) .Values.taxonomy.llm.vertex.existingSecret -}}
{{- end }}

{{- define "formbricks.taxonomyServiceUrl" -}}
{{- printf "http://%s:%v" (include "formbricks.taxonomyName" .) (.Values.taxonomy.service.port | default .Values.taxonomy.port) -}}
{{- end }}

{{- define "formbricks.taxonomyLlmBaseUrl" -}}
{{- if .Values.taxonomy.llm.baseUrl -}}
{{- include "formbricks.tplvalues.render" (dict "value" .Values.taxonomy.llm.baseUrl "context" .) -}}
{{- else if .Values.llm.enabled -}}
{{- include "formbricks.llmBaseUrl" . -}}
{{- else -}}
{{- "" -}}
{{- end -}}
{{- end }}

{{- define "formbricks.taxonomyServiceToken" -}}
{{- $secretName := include "formbricks.taxonomyManagedSecretName" . }}
{{- $secretKey := .Values.taxonomy.auth.serviceTokenKey | default "TAXONOMY_SERVICE_TOKEN" }}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace $secretName) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData $secretKey }}
    {{- index $secretData $secretKey | b64dec -}}
{{- else if .Values.taxonomy.auth.serviceToken }}
    {{- .Values.taxonomy.auth.serviceToken -}}
{{- else }}
    {{- randAlphaNum 48 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.taxonomyHubInternalApiToken" -}}
{{- $secretName := include "formbricks.taxonomyManagedSecretName" . }}
{{- $secretKey := .Values.taxonomy.auth.hubInternalApiTokenKey | default "HUB_INTERNAL_API_TOKEN" }}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace $secretName) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData $secretKey }}
    {{- index $secretData $secretKey | b64dec -}}
{{- else if .Values.taxonomy.auth.hubInternalApiToken }}
    {{- .Values.taxonomy.auth.hubInternalApiToken -}}
{{- else }}
    {{- randAlphaNum 48 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.taxonomyLlmApiKey" -}}
{{- $secretName := include "formbricks.taxonomyManagedSecretName" . }}
{{- $secretKey := .Values.taxonomy.llm.apiKeySecretKey | default "TAXONOMY_LLM_API_KEY" }}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace $secretName) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData $secretKey }}
    {{- index $secretData $secretKey | b64dec -}}
{{- else if .Values.taxonomy.llm.apiKey }}
    {{- .Values.taxonomy.llm.apiKey -}}
{{- else }}
    {{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.taxonomyVertexCredentialsJson" -}}
{{- $secretName := include "formbricks.taxonomyManagedSecretName" . }}
{{- $secretKey := .Values.taxonomy.llm.vertex.credentialsJsonSecretKey | default "TAXONOMY_GOOGLE_CLOUD_CREDENTIALS_JSON" }}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace $secretName) }}
{{- $secretData := dig "data" dict $secret }}
{{- if .Values.taxonomy.llm.vertex.credentialsJson }}
    {{- .Values.taxonomy.llm.vertex.credentialsJson -}}
{{- else if index $secretData $secretKey }}
    {{- index $secretData $secretKey | b64dec -}}
{{- else }}
    {{- "" -}}
{{- end -}}
{{- end }}

{{/*
Hub env managed by taxonomy when the optional taxonomy service is enabled.
*/}}
{{- define "formbricks.taxonomyHubEnv" -}}
{{- $root := .root -}}
{{- if and $root.Values.taxonomy.enabled $root.Values.taxonomy.autoConfigureHub }}
- name: TAXONOMY_SERVICE_URL
  value: {{ include "formbricks.taxonomyServiceUrl" $root | quote }}
- name: TAXONOMY_SERVICE_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "formbricks.taxonomyAuthSecretName" $root }}
      key: {{ $root.Values.taxonomy.auth.serviceTokenKey | default "TAXONOMY_SERVICE_TOKEN" }}
- name: HUB_INTERNAL_API_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "formbricks.taxonomyAuthSecretName" $root }}
      key: {{ $root.Values.taxonomy.auth.hubInternalApiTokenKey | default "HUB_INTERNAL_API_TOKEN" }}
{{- end }}
{{- end }}

{{/*
Returns true when an env var is managed by taxonomy auto-configuration and should not be rendered from hub.env.
*/}}
{{- define "formbricks.taxonomyHubEnvManaged" -}}
{{- $key := .key -}}
{{- if has $key (list "TAXONOMY_SERVICE_URL" "TAXONOMY_SERVICE_TOKEN" "HUB_INTERNAL_API_TOKEN") -}}
true
{{- end -}}
{{- end }}

{{/*
Returns true when an env var is managed by the taxonomy deployment and should not be rendered from taxonomy.env.
*/}}
{{- define "formbricks.taxonomyEnvManaged" -}}
{{- $key := .key -}}
{{- if has $key (list "APP_ENV" "HUB_INTERNAL_API_URL" "HUB_INTERNAL_API_TOKEN" "TAXONOMY_SERVICE_TOKEN" "TAXONOMY_LLM_PROVIDER" "TAXONOMY_LLM_MODEL" "TAXONOMY_LLM_BASE_URL" "TAXONOMY_LLM_API_KEY" "TAXONOMY_VERTEX_PROJECT" "TAXONOMY_VERTEX_LOCATION" "TAXONOMY_GOOGLE_CLOUD_CREDENTIALS_JSON" "TAXONOMY_LLM_TEMPERATURE" "TAXONOMY_LLM_MAX_ATTEMPTS" "TAXONOMY_LLM_TIMEOUT_SECONDS" "HUB_CLIENT_TIMEOUT_SECONDS" "TAXONOMY_EMBEDDING_DIMENSION" "TAXONOMY_MIN_EMBEDDED_RECORDS" "TAXONOMY_MAX_RECORDS" "TAXONOMY_MAX_CLUSTERS" "TAXONOMY_RANDOM_SEED") -}}
true
{{- end -}}
{{- end }}

{{/*
Hub embeddings runtime resource name.
*/}}
{{- define "formbricks.hubEmbeddingsName" -}}
{{- $base := include "formbricks.name" . | trunc 48 | trimSuffix "-" }}
{{- printf "%s-hub-embeddings" $base | trimSuffix "-" }}
{{- end }}

{{/*
Secret used by Hub and the embeddings runtime for the embeddings API key.
*/}}
{{- define "formbricks.hubEmbeddingsSecretName" -}}
{{- default (printf "%s-secret" (include "formbricks.hubEmbeddingsName" .)) .Values.hub.embeddings.auth.existingSecret -}}
{{- end }}

{{/*
Secret used by the embeddings runtime for Hugging Face access.
*/}}
{{- define "formbricks.hubEmbeddingsHuggingFaceSecretName" -}}
{{- default (include "formbricks.hubEmbeddingsSecretName" .) .Values.hub.embeddings.huggingFace.existingSecret -}}
{{- end }}

{{/*
Model name Hub sends to the OpenAI-compatible embeddings endpoint.
*/}}
{{- define "formbricks.hubEmbeddingsServedModelName" -}}
{{- default .Values.hub.embeddings.model .Values.hub.embeddings.servedModelName -}}
{{- end }}

{{/*
OpenAI-compatible embeddings base URL used by Hub.
*/}}
{{- define "formbricks.hubEmbeddingsBaseURL" -}}
{{- if .Values.hub.embeddings.baseUrl -}}
{{- .Values.hub.embeddings.baseUrl -}}
{{- else -}}
{{- printf "http://%s:%v/v1" (include "formbricks.hubEmbeddingsName" .) (.Values.hub.embeddings.service.port | default .Values.hub.embeddings.port) -}}
{{- end -}}
{{- end }}

{{/*
Embedding API key value for the generated embeddings secret.
*/}}
{{- define "formbricks.hubEmbeddingsApiKey" -}}
{{- $secretName := include "formbricks.hubEmbeddingsSecretName" . }}
{{- $secretKey := .Values.hub.embeddings.auth.secretKey | default "EMBEDDING_PROVIDER_API_KEY" }}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace $secretName) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData $secretKey }}
    {{- index $secretData $secretKey | b64dec -}}
{{- else if .Values.hub.embeddings.auth.apiKey }}
    {{- .Values.hub.embeddings.auth.apiKey -}}
{{- else }}
    {{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{/*
Shared Hub embedding env. These values are managed from hub.embeddings when the
self-hosted runtime is enabled so Hub API and Hub worker cannot drift.
*/}}
{{- define "formbricks.hubEmbeddingEnv" -}}
{{- $root := .root -}}
{{- if $root.Values.hub.embeddings.enabled }}
- name: EMBEDDING_PROVIDER
  value: "openai"
- name: EMBEDDING_MODEL
  value: {{ include "formbricks.hubEmbeddingsServedModelName" $root | quote }}
- name: EMBEDDING_BASE_URL
  value: {{ include "formbricks.hubEmbeddingsBaseURL" $root | quote }}
- name: EMBEDDING_PROVIDER_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "formbricks.hubEmbeddingsSecretName" $root }}
      key: {{ $root.Values.hub.embeddings.auth.secretKey | default "EMBEDDING_PROVIDER_API_KEY" }}
- name: EMBEDDING_MAX_CONCURRENT
  value: {{ $root.Values.hub.embeddings.maxConcurrent | quote }}
- name: EMBEDDING_NORMALIZE
  value: {{ $root.Values.hub.embeddings.normalize | quote }}
{{- end }}
{{- end }}

{{/*
Returns true when an env var is managed by hub.embeddings and should not be rendered from hub.env/worker.env.
*/}}
{{- define "formbricks.hubEmbeddingEnvManaged" -}}
{{- $key := .key -}}
{{- if has $key (list "EMBEDDING_PROVIDER" "EMBEDDING_MODEL" "EMBEDDING_BASE_URL" "EMBEDDING_PROVIDER_API_KEY" "EMBEDDING_MAX_CONCURRENT" "EMBEDDING_NORMALIZE") -}}
true
{{- end -}}
{{- end }}


{{- define "formbricks.postgresAdminPassword" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (include "formbricks.appSecretName" .)) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData "POSTGRES_ADMIN_PASSWORD" }}
    {{- index $secretData "POSTGRES_ADMIN_PASSWORD" | b64dec -}}
{{- else }}
    {{- randAlphaNum 16 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.postgresUserPassword" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (include "formbricks.appSecretName" .)) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData "POSTGRES_USER_PASSWORD" }}
    {{- index $secretData "POSTGRES_USER_PASSWORD" | b64dec -}}
{{- else }}
    {{- randAlphaNum 16 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.redisPassword" -}}
{{- $redisSecretName := include "formbricks.redisSecretName" . }}
{{- $redisSecretKey := include "formbricks.redisSecretKey" . }}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace $redisSecretName) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData $redisSecretKey }}
    {{- index $secretData $redisSecretKey | b64dec -}}
{{- else if eq $redisSecretName (include "formbricks.appSecretName" .) }}
    {{- randAlphaNum 16 -}}
{{- else }}
    {{- fail (printf "redis.auth.existingSecret %q must already exist in namespace %q and contain %s when secret.enabled=true so REDIS_URL can use the same password as the bundled Valkey server. Disable secret.enabled and provide app-secrets externally, or pre-create the Redis auth secret." $redisSecretName .Release.Namespace $redisSecretKey) -}}
{{- end -}}
{{- end }}

{{- define "formbricks.cronSecret" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (include "formbricks.appSecretName" .)) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData "CRON_SECRET" }}
    {{- index $secretData "CRON_SECRET" | b64dec -}}
{{- else if and $secret (hasKey $secret "data") }}
    {{- fail (printf "Secret %q exists in namespace %q but is missing CRON_SECRET" (include "formbricks.appSecretName" .) .Release.Namespace) -}}
{{- else }}
    {{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.encryptionKey" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (include "formbricks.appSecretName" .)) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData "ENCRYPTION_KEY" }}
    {{- index $secretData "ENCRYPTION_KEY" | b64dec -}}
{{- else if and $secret (hasKey $secret "data") }}
    {{- fail (printf "Secret %q exists in namespace %q but is missing ENCRYPTION_KEY" (include "formbricks.appSecretName" .) .Release.Namespace) -}}
{{- else }}
    {{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.nextAuthSecret" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (include "formbricks.appSecretName" .)) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData "NEXTAUTH_SECRET" }}
    {{- index $secretData "NEXTAUTH_SECRET" | b64dec -}}
{{- else if and $secret (hasKey $secret "data") }}
    {{- fail (printf "Secret %q exists in namespace %q but is missing NEXTAUTH_SECRET" (include "formbricks.appSecretName" .) .Release.Namespace) -}}
{{- else }}
    {{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.hubApiKey" -}}
{{- $hubSecretName := include "formbricks.hubSecretName" . }}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace $hubSecretName) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData "HUB_API_KEY" }}
    {{- index $secretData "HUB_API_KEY" | b64dec -}}
{{- else if .Values.hub.existingSecret }}
    {{- fail (printf "hub.existingSecret %q must already exist in namespace %q and contain HUB_API_KEY when rendering the generated app secret. Disable secret.enabled and provide app-secrets externally, or pre-create the Hub secret." $hubSecretName .Release.Namespace) -}}
{{- else }}
    {{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.cubejsApiSecret" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (include "formbricks.appSecretName" .)) }}
{{- $secretData := dig "data" dict $secret }}
{{- if index $secretData "CUBEJS_API_SECRET" }}
    {{- index $secretData "CUBEJS_API_SECRET" | b64dec -}}
{{- else }}
    {{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}
{{- define "formbricks.envoy.gatewayClassName" -}}
{{- if .Values.envoy.formbricks.gatewayClass.name -}}
{{- .Values.envoy.formbricks.gatewayClass.name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s-envoy" .Release.Name (include "formbricks.namespace" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{- define "formbricks.envoy.gatewayName" -}}
{{- if .Values.envoy.formbricks.gateway.name -}}
{{- .Values.envoy.formbricks.gateway.name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-envoy-gateway" (include "formbricks.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{- define "formbricks.envoy.proxyName" -}}
{{- if .Values.envoy.formbricks.proxy.name -}}
{{- .Values.envoy.formbricks.proxy.name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-envoy-proxy" (include "formbricks.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{- define "formbricks.envoy.proxyServiceName" -}}
{{- if .Values.envoy.formbricks.proxy.service.name -}}
{{- .Values.envoy.formbricks.proxy.service.name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-envoy" (include "formbricks.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{- define "formbricks.envoy.ingressHost" -}}
{{- if .Values.envoy.formbricks.ingress.host -}}
{{- tpl .Values.envoy.formbricks.ingress.host $ -}}
{{- else if and .Values.ingress.hosts (gt (len .Values.ingress.hosts) 0) -}}
{{- tpl (index .Values.ingress.hosts 0).host $ -}}
{{- end -}}
{{- end }}

{{- define "formbricks.envoy.defaultRedisUrl" -}}
{{- printf "%s-master:6379" .Values.envoyRedis.fullnameOverride -}}
{{- end }}
