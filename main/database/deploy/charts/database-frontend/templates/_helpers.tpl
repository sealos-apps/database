{{/* Expand the name of the chart. */}}
{{- define "database-frontend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Create a default fully qualified app name. */}}
{{- define "database-frontend.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "database-frontend.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "database-frontend.labels" -}}
helm.sh/chart: {{ include "database-frontend.chart" . }}
{{ include "database-frontend.selectorLabels" . }}
{{ include "database-frontend.recommendedLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "database-frontend.selectorLabels" -}}
app: {{ include "database-frontend.fullname" . }}
{{- end }}

{{- define "database-frontend.recommendedLabels" -}}
app.kubernetes.io/name: {{ include "database-frontend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "database-frontend.scheme" -}}
{{- if eq (toString .Values.databaseConfig.disableHttps) "true" -}}http{{- else -}}https{{- end -}}
{{- end }}

{{- define "database-frontend.port" -}}
{{- $scheme := include "database-frontend.scheme" . -}}
{{- $port := toString .Values.databaseConfig.cloudPort -}}
{{- if eq $scheme "http" -}}
{{- $port = toString .Values.databaseConfig.httpPort -}}
{{- end -}}
{{- if or (and (eq $scheme "https") (or (eq $port "") (eq $port "443"))) (and (eq $scheme "http") (or (eq $port "") (eq $port "80"))) -}}
{{- "" -}}
{{- else -}}
{{- $port -}}
{{- end }}
{{- end }}

{{- define "database-frontend.portSuffix" -}}
{{- $port := include "database-frontend.port" . -}}
{{- if $port -}}:{{ $port }}{{- end -}}
{{- end }}

{{- define "database-frontend.portEnv" -}}
{{- $port := include "database-frontend.port" . -}}
{{- if $port -}}:{{ $port }}{{- end -}}
{{- end }}

{{- define "database-frontend.cloudOrigin" -}}
{{- include "database-frontend.scheme" . -}}://{{ .Values.databaseConfig.cloudDomain }}{{ include "database-frontend.portSuffix" . }}
{{- end }}

{{- define "database-frontend.wildcardCloudOrigin" -}}
{{- include "database-frontend.scheme" . -}}://*.{{ .Values.databaseConfig.cloudDomain }}{{ include "database-frontend.portSuffix" . }}
{{- end }}

{{- define "database-frontend.host" -}}
{{- default (printf "database.%s" .Values.databaseConfig.cloudDomain) .Values.ingress.host -}}
{{- end }}

{{- define "database-frontend.appUrl" -}}
{{- include "database-frontend.scheme" . -}}://{{ include "database-frontend.host" . }}{{ include "database-frontend.portSuffix" . }}
{{- end }}
