{{/*
Expand the name of the chart.
*/}}
{{- define "database-frontend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
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

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "database-frontend.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "database-frontend.labels" -}}
helm.sh/chart: {{ include "database-frontend.chart" . }}
{{ include "database-frontend.selectorLabels" . }}
{{ include "database-frontend.recommendedLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels keep compatibility with the previous manifest selector.
*/}}
{{- define "database-frontend.selectorLabels" -}}
app: {{ include "database-frontend.fullname" . }}
{{- end }}

{{/*
Recommended Kubernetes labels.
*/}}
{{- define "database-frontend.recommendedLabels" -}}
app.kubernetes.io/name: {{ include "database-frontend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "database-frontend.portSuffix" -}}
{{- $port := trimPrefix ":" (toString .Values.databaseConfig.cloudPort) -}}
{{- if $port -}}:{{ $port }}{{- end -}}
{{- end }}

{{- define "database-frontend.host" -}}
{{- default (printf "database.%s" .Values.databaseConfig.cloudDomain) .Values.ingress.host -}}
{{- end }}

{{- define "database-frontend.url" -}}
https://{{ include "database-frontend.host" . }}{{ include "database-frontend.portSuffix" . }}
{{- end }}
