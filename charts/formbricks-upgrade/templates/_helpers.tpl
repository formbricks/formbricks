{{/* Chart name. */}}
{{- define "formbricks-upgrade.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Chart label. */}}
{{- define "formbricks-upgrade.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common resource labels. */}}
{{- define "formbricks-upgrade.labels" -}}
helm.sh/chart: {{ include "formbricks-upgrade.chart" . }}
app.kubernetes.io/name: {{ include "formbricks-upgrade.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: v6-authzed-upgrade
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ .Values.targetRelease }}
formbricks.com/upgrade-generation: {{ .Values.generation | quote }}
formbricks.com/upgrade-phase: {{ .Values.phase | quote }}
formbricks.com/upgrade-execution: {{ .Values.execution | quote }}
formbricks.com/target-release: {{ .Values.targetRelease | quote }}
{{- end -}}

{{/* The plan ConfigMap doubles as an install-order ownership mutex before the Job can start. */}}
{{- define "formbricks-upgrade.planName" -}}
{{- $prefix := .Values.targetRelease | trunc 43 | trimSuffix "-" -}}
{{- printf "%s-%s-v6-plan" $prefix (sha256sum .Values.targetRelease | trunc 8) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* The Lease name depends only on the target release so concurrent temporary releases collide. */}}
{{- define "formbricks-upgrade.leaseName" -}}
{{- $prefix := .Values.targetRelease | trunc 44 | trimSuffix "-" -}}
{{- printf "%s-%s-v6-lock" $prefix (sha256sum .Values.targetRelease | trunc 8) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Job names retain the phase, generation hash, and rerun execution suffix. */}}
{{- define "formbricks-upgrade.jobName" -}}
{{- $prefix := .Values.targetRelease | trunc 23 | trimSuffix "-" -}}
{{- printf "%s-%s-%s-%s-%d" $prefix (.Values.targetRelease | sha256sum | trunc 6) .Values.phase (.Values.generation | sha256sum | trunc 6) (.Values.execution | int) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Exact immutable bridge image run by every phase. */}}
{{- define "formbricks-upgrade.bridgeImage" -}}
{{- printf "%s@%s" .Values.images.bridge.repository .Values.images.bridge.digest -}}
{{- end -}}

{{/* Exact immutable candidate image recorded in the upgrade plan; it is never run by this chart. */}}
{{- define "formbricks-upgrade.candidateImage" -}}
{{- printf "%s@%s" .Values.images.candidate.repository .Values.images.candidate.digest -}}
{{- end -}}

{{/* Every phase Job runs the exact bridge image. Candidate execution stays outside this chart. */}}
{{- define "formbricks-upgrade.phaseImage" -}}
{{- include "formbricks-upgrade.bridgeImage" . -}}
{{- end -}}

{{/* Phase-specific deadline. */}}
{{- define "formbricks-upgrade.activeDeadlineSeconds" -}}
{{- if eq .Values.phase "prepare" -}}
{{- .Values.job.activeDeadlineSeconds.prepare -}}
{{- else if eq .Values.phase "audit" -}}
{{- .Values.job.activeDeadlineSeconds.audit -}}
{{- else if eq .Values.phase "activate" -}}
{{- .Values.job.activeDeadlineSeconds.activate -}}
{{- else if eq .Values.phase "rollback-begin" -}}
{{- .Values.job.activeDeadlineSeconds.rollbackBegin -}}
{{- else if eq .Values.phase "rollback-complete" -}}
{{- .Values.job.activeDeadlineSeconds.rollbackComplete -}}
{{- end -}}
{{- end -}}

{{/* Cross-field checks that JSON Schema cannot express. */}}
{{- define "formbricks-upgrade.validate" -}}
{{- $receiptPhases := list "activate" "rollback-begin" "rollback-complete" -}}
{{- if and (has .Values.phase $receiptPhases) (empty .Values.activation.receipt) -}}
{{- fail (printf "activation.receipt is required for phase %s" .Values.phase) -}}
{{- end -}}
{{- $quiescedPhases := list "activate" "rollback-begin" -}}
{{- if and (has .Values.phase $quiescedPhases) (not .Values.activation.workloadQuiesced) -}}
{{- fail (printf "activation.workloadQuiesced=true is required for phase %s after the outgoing Formbricks workload and HPA are quiesced" .Values.phase) -}}
{{- end -}}
{{- $bridgeLeaf := regexFind "[^/]+$" .Values.images.bridge.repository -}}
{{- if or (contains "@" .Values.images.bridge.repository) (contains ":" $bridgeLeaf) -}}
{{- fail "images.bridge.repository must not contain a tag or digest; set images.bridge.digest separately" -}}
{{- end -}}
{{- $candidateLeaf := regexFind "[^/]+$" .Values.images.candidate.repository -}}
{{- if or (contains "@" .Values.images.candidate.repository) (contains ":" $candidateLeaf) -}}
{{- fail "images.candidate.repository must not contain a tag or digest; set images.candidate.digest separately" -}}
{{- end -}}
{{- $portText := regexFind "[0-9]+$" .Values.authzed.endpoint -}}
{{- if or (empty $portText) (gt (atoi $portText) 65535) -}}
{{- fail "authzed.endpoint must use a port from 1 through 65535" -}}
{{- end -}}
{{- if ne .Values.authzed.consistency "fully_consistent" -}}
{{- fail "authzed.consistency must be fully_consistent for the v6 upgrade" -}}
{{- end -}}
{{- end -}}
