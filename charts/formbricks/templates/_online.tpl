{{- define "formbricks.onlineGeneration" -}}
{{- .Values.deployment.image.digest | trimPrefix "sha256:" | trunc 32 -}}
{{- end -}}

{{- define "formbricks.cubeImage" -}}
{{- if .Values.cube.image.digest -}}
{{- printf "%s@%s" .Values.cube.image.repository .Values.cube.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.cube.image.repository .Values.cube.image.tag -}}
{{- end -}}
{{- end -}}
