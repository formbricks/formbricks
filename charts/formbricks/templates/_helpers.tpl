{{/*
Expand the name of the chart.
This function ensures that the chart name is either taken from `nameOverride` or defaults to `.Chart.Name`.
It also truncates the name to a maximum of 63 characters and removes trailing hyphens.
*/}}
{{- define "formbricks.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
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
Allow the release namespace to be overridden.
If `namespaceOverride` is provided, it will be used; otherwise, it defaults to `.Release.Namespace`.
*/}}
{{- define "formbricks.namespace" -}}
{{- default .Release.Namespace .Values.namespaceOverride -}}
{{- end -}}


{{- define "formbricks.postgresAdminPassword" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (printf "%s-app-secrets" (include "formbricks.name" .))) }}
{{- if and $secret (index $secret.data "POSTGRES_ADMIN_PASSWORD") }}
    {{- index $secret.data "POSTGRES_ADMIN_PASSWORD" | b64dec -}}
{{- else }}
    {{- randAlphaNum 16 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.postgresUserPassword" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (printf "%s-app-secrets" (include "formbricks.name" .))) }}
{{- if and $secret (index $secret.data "POSTGRES_USER_PASSWORD") }}
    {{- index $secret.data "POSTGRES_USER_PASSWORD" | b64dec -}}
{{- else }}
    {{- randAlphaNum 16 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.redisPassword" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (printf "%s-app-secrets" (include "formbricks.name" .))) }}
{{- if and $secret (index $secret.data "REDIS_PASSWORD") }}
    {{- index $secret.data "REDIS_PASSWORD" | b64dec -}}
{{- else }}
    {{- randAlphaNum 16 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.cronSecret" -}}	
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (printf "%s-app-secrets" (include "formbricks.name" .))) }}	
{{- if $secret }}	
    {{- index $secret.data "CRON_SECRET" | b64dec -}}	
{{- else }}	
    {{- randAlphaNum 32 -}}	
{{- end -}}	
{{- end }}

{{- define "formbricks.encryptionKey" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (printf "%s-app-secrets" (include "formbricks.name" .))) }}
{{- if $secret }}
    {{- index $secret.data "ENCRYPTION_KEY" | b64dec -}}
{{- else }}
    {{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{- define "formbricks.nextAuthSecret" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (printf "%s-app-secrets" (include "formbricks.name" .))) }}
{{- if $secret }}
    {{- index $secret.data "NEXTAUTH_SECRET" | b64dec -}}
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
