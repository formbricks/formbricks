{{/**/}}
{{/*Define the Pod template for Formbricks deployment.*/}}
{{/*This template generates the `spec` section of the Pod for deployment configurations.*/}}
{{/**/}}
{{/*{{- define "formbricks.podTemplate" }}*/}}
{{/*    metadata:*/}}
{{/*      labels:*/}}
{{/*        # Include standard selector labels*/}}
{{/*        {{- include "formbricks.selectorLabels" . | nindent 8 }}*/}}

{{/*        # Additional labels if defined in values*/}}
{{/*        {{- if .Values.deployment.additionalPodLabels }}*/}}
{{/*          {{- toYaml .Values.deployment.additionalPodLabels | nindent 8 }}*/}}
{{/*        {{- end }}*/}}

{{/*        # Disable Istio sidecar injection if configured*/}}
{{/*        {{- if .Values.deployment.disableIstioInject }}*/}}
{{/*        sidecar.istio.io/inject: "false"*/}}
{{/*        {{- end }}*/}}

{{/*      # Additional annotations if defined in values*/}}
{{/*      {{- if .Values.deployment.additionalPodAnnotations }}*/}}
{{/*      annotations:*/}}
{{/*        {{- toYaml .Values.deployment.additionalPodAnnotations | nindent 8 }}*/}}
{{/*      {{- end }}*/}}

{{/*    spec:*/}}
{{/*      # Define initContainers if provided*/}}
{{/*      {{- if .Values.deployment.initContainers }}*/}}
{{/*      initContainers:*/}}
{{/*      {{- range $key, $value := .Values.deployment.initContainers }}*/}}
{{/*        - name: {{ $key }}*/}}
{{/*          {{- include "formbricks.tplvalues.render" ( dict "value" $value "context" $ ) | nindent 10 }}*/}}
{{/*      {{- end }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Set nodeSelector if defined*/}}
{{/*      {{- with .Values.deployment.nodeSelector }}*/}}
{{/*      nodeSelector:*/}}
{{/*      {{- toYaml . | nindent 8 }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Define tolerations if provided*/}}
{{/*      {{- with .Values.deployment.tolerations }}*/}}
{{/*      tolerations:*/}}
{{/*      {{- toYaml . | nindent 8 }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Define affinity rules if provided*/}}
{{/*      {{- with .Values.deployment.affinity }}*/}}
{{/*      affinity:*/}}
{{/*      {{- toYaml . | nindent 8 }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Define topology spread constraints if specified*/}}
{{/*      {{- with .Values.deployment.topologySpreadConstraints }}*/}}
{{/*      topologySpreadConstraints:*/}}
{{/*        {{- toYaml . | nindent 10 }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Set image pull secrets if provided*/}}
{{/*      {{- with .Values.deployment.imagePullSecrets }}*/}}
{{/*      imagePullSecrets:*/}}
{{/*        {{- toYaml . | nindent 8 }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Enable host networking if required*/}}
{{/*      {{- if .Values.deployment.hostNetwork }}*/}}
{{/*      hostNetwork: true*/}}
{{/*      {{- end }}*/}}

{{/*      # Assign a service account if RBAC is enabled*/}}
{{/*      {{- if .Values.rbac.serviceAccount.enabled }}*/}}
{{/*      {{- if .Values.rbac.serviceAccount.name }}*/}}
{{/*      serviceAccountName: {{ .Values.rbac.serviceAccount.name }}*/}}
{{/*      {{- else }}*/}}
{{/*      serviceAccountName: {{ template "formbricks.name" $ }}*/}}
{{/*      {{- end }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Set security context if defined*/}}
{{/*      {{- if .Values.deployment.securityContext }}*/}}
{{/*      securityContext:*/}}
{{/*        {{ toYaml .Values.deployment.securityContext | indent 8 }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Define termination grace period*/}}
{{/*      terminationGracePeriodSeconds: {{ .Values.deployment.terminationGracePeriodSeconds }}*/}}

{{/*      # Define volumes if specified*/}}
{{/*      {{- if .Values.deployment.volumes }}*/}}
{{/*      volumes:*/}}
{{/*        {{- range $key, $value := .Values.deployment.volumes }}*/}}
{{/*        - name: {{ $key }}*/}}
{{/*          {{- include "formbricks.tplvalues.render" ( dict "value" $value "context" $ ) | nindent 10 }}*/}}
{{/*        {{- end }}*/}}
{{/*      {{- end }}*/}}

{{/*      # Define the main application container*/}}
{{/*      containers:*/}}
{{/*        - name: {{ template "formbricks.name" . }}*/}}
{{/*          image: "{{ .Values.deployment.image.repository }}{{ if .Values.deployment.image.tag }}:{{ .Values.deployment.image.tag }}{{ else }}@{{ .Values.deployment.image.digest }}{{ end }}"*/}}
{{/*          imagePullPolicy: {{ .Values.deployment.image.pullPolicy }}*/}}

{{/*          # Set command if provided*/}}
{{/*          {{- with .Values.deployment.command }}*/}}
{{/*          command:*/}}
{{/*            {{- toYaml . | nindent 12 }}*/}}
{{/*          {{- end }}*/}}

{{/*          # Set arguments if provided*/}}
{{/*          {{- with .Values.deployment.args }}*/}}
{{/*          args:*/}}
{{/*            {{- toYaml . | nindent 12 }}*/}}
{{/*          {{- end }}*/}}

{{/*          # Define container ports if specified*/}}
{{/*          {{- if .Values.deployment.ports }}*/}}
{{/*          ports:*/}}
{{/*            {{- $hostNetwork := .Values.deployment.hostNetwork }}*/}}
{{/*            {{- range $name, $config := .Values.deployment.ports }}*/}}
{{/*            {{- if $config }}*/}}
{{/*            {{- if and $hostNetwork (and $config.hostPort $config.port) }}*/}}
{{/*              # Enforce hostPort and containerPort match when hostNetwork is enabled*/}}
{{/*              {{- if ne ($config.hostPort | int) ($config.port | int) }}*/}}
{{/*                {{- fail "ERROR: All hostPort must match their respective containerPort when `hostNetwork` is enabled" }}*/}}
{{/*              {{- end }}*/}}
{{/*            {{- end }}*/}}
{{/*            - name: {{ $name | quote }}*/}}
{{/*              containerPort: {{ default $config.port $config.containerPort }}*/}}
{{/*              {{- if $config.hostPort }}*/}}
{{/*              hostPort: {{ $config.hostPort }}*/}}
{{/*              {{- end }}*/}}
{{/*              protocol: {{ default "TCP" $config.protocol | quote }}*/}}
{{/*            {{- end }}*/}}
{{/*            {{- end }}*/}}
{{/*          {{- end }}*/}}

{{/*          # Define environment variables from ConfigMaps or Secrets*/}}
{{/*          {{- if .Values.deployment.envFrom }}*/}}
{{/*          envFrom:*/}}
{{/*          {{- range $value := .Values.deployment.envFrom }}*/}}
{{/*          {{- if (eq .type "configmap") }}*/}}
{{/*            - configMapRef:*/}}
{{/*                name: {{ include "formbricks.tplvalues.render" ( dict "value" (default (printf "%s-%s" (include "formbricks.name" $) $value.nameSuffix) $value.name) "context" $ ) }}*/}}
{{/*          {{- end }}*/}}
{{/*          {{- if (eq .type "secret") }}*/}}
{{/*            - secretRef:*/}}
{{/*               name: {{ include "formbricks.tplvalues.render" ( dict "value" (default (printf "%s-%s" (include "formbricks.name" $) $value.nameSuffix) $value.name) "context" $ ) }}*/}}
{{/*          {{- end }}*/}}
{{/*          {{- end }}*/}}
{{/*          {{- end }}*/}}

{{/*          # Define direct environment variables*/}}
{{/*          {{- if .Values.deployment.env }}*/}}
{{/*          env:*/}}
{{/*          {{- range $key, $value := .Values.deployment.env }}*/}}
{{/*          - name: {{ include "formbricks.tplvalues.render" ( dict "value" $key "context" $ ) }}*/}}
{{/*            {{- include "formbricks.tplvalues.render" ( dict "value" $value "context" $ ) | nindent 12 }}*/}}
{{/*          {{- end }}*/}}
{{/*          {{- end }}*/}}

{{/*          # Configure probes for health checks*/}}
{{/*          {{- with .Values.deployment.probes }}*/}}
{{/*          {{- if .livenessProbe }}*/}}
{{/*          livenessProbe:*/}}
{{/*            {{- toYaml .livenessProbe | nindent 12 }}*/}}
{{/*          {{- end }}*/}}
{{/*          {{- if .readinessProbe }}*/}}
{{/*          readinessProbe:*/}}
{{/*            {{- toYaml .readinessProbe | nindent 12 }}*/}}
{{/*          {{- end }}*/}}
{{/*          {{- if .startupProbe }}*/}}
{{/*          startupProbe:*/}}
{{/*            {{- toYaml .startupProbe | nindent 12 }}*/}}
{{/*          {{- end }}*/}}
{{/*          {{- end }}*/}}

{{/*          # Define volume mounts if specified*/}}
{{/*          {{- if .Values.deployment.volumeMounts }}*/}}
{{/*          volumeMounts:*/}}
{{/*          {{- range $key, $value := .Values.deployment.volumeMounts }}*/}}
{{/*          - name: {{ $key }}*/}}
{{/*            {{- include "formbricks.tplvalues.render" ( dict "value" $value "context" $ ) | nindent 12 }}*/}}
{{/*          {{- end }}*/}}
{{/*          {{- end }}*/}}
{{/*{{ end -}}*/}}