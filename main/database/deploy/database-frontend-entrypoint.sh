#!/bin/bash
set -e

RELEASE_NAME=${RELEASE_NAME:-"database-frontend"}
RELEASE_NAMESPACE=${RELEASE_NAMESPACE:-"database-frontend"}
CHART_PATH=${CHART_PATH:-"./charts/database-frontend"}
HELM_OPTS=${HELM_OPTS:-""}
HELM_OPTIONS=${HELM_OPTIONS:-""}
AUTO_CONFIG_HELM_OPTS=""

get_cm_value() {
  local namespace="$1"
  local name="$2"
  local key="$3"
  kubectl get configmap "${name}" -n "${namespace}" -o "jsonpath={.data.${key}}" 2>/dev/null || true
}

add_set_string() {
  local key="$1"
  local value="$2"
  if [ -n "${value}" ]; then
    AUTO_CONFIG_HELM_OPTS="${AUTO_CONFIG_HELM_OPTS} --set-string ${key}=${value}"
  fi
}

SEALOS_CLOUD_DOMAIN=${SEALOS_CLOUD_DOMAIN:-"${cloudDomain:-$(get_cm_value sealos-system sealos-config cloudDomain)}"}
add_set_string databaseConfig.cloudDomain "${SEALOS_CLOUD_DOMAIN}"
SEALOS_CLOUD_PORT=${SEALOS_CLOUD_PORT:-"${cloudPort:-$(get_cm_value sealos-system sealos-config cloudPort)}"}
add_set_string databaseConfig.cloudPort "${SEALOS_CLOUD_PORT}"
SEALOS_HTTP_PORT=${SEALOS_HTTP_PORT:-"${httpPort:-$(get_cm_value sealos-system sealos-config httpPort)}"}
add_set_string databaseConfig.httpPort "${SEALOS_HTTP_PORT}"
SEALOS_DISABLE_HTTPS=${SEALOS_DISABLE_HTTPS:-"${disableHttps:-$(get_cm_value sealos-system sealos-config disableHttps)}"}
add_set_string databaseConfig.disableHttps "${SEALOS_DISABLE_HTTPS}"
SEALOS_CERT_SECRET_NAME=${SEALOS_CERT_SECRET_NAME:-"${certSecretName:-$(get_cm_value sealos-system sealos-config certSecretName)}"}
add_set_string databaseConfig.certSecretName "${SEALOS_CERT_SECRET_NAME}"
add_set_string databaseConfig.monitorUrl "${monitorUrl:-}"
add_set_string databaseConfig.minioUrl "${minioUrl:-}"
add_set_string databaseConfig.minioAccessKey "${minioAccessKey:-}"
add_set_string databaseConfig.minioSecretKey "${minioSecretKey:-}"
add_set_string databaseConfig.minioPort "${minioPort:-}"
add_set_string databaseConfig.minioUseSSL "${minioUseSSL:-}"
add_set_string databaseConfig.minioBucketName "${minioBucketName:-}"
add_set_string databaseConfig.migrateFileFetchFileImage "${migrateFileFetchFileImage:-}"
add_set_string databaseConfig.migrateFileImportDataImage "${migrateFileImportDataImage:-}"
add_set_string databaseConfig.guideEnabled "${guideEnabled:-}"
add_set_string databaseConfig.billingUrl "${billingUrl:-}"
add_set_string databaseConfig.billingSecret "${billingSecret:-}"
add_set_string databaseConfig.alertingUrl "${alertingUrl:-}"
add_set_string databaseConfig.alertingSecret "${alertingSecret:-}"
add_set_string databaseConfig.vlogsBaseUrl "${vlogsBaseUrl:-}"
add_set_string databaseConfig.migrationJobCPURequirement "${migrationJobCPURequirement:-}"
add_set_string databaseConfig.migrationJobMemoryRequirement "${migrationJobMemoryRequirement:-}"
add_set_string databaseConfig.dumpImportJobCPURequirement "${dumpImportJobCPURequirement:-}"
add_set_string databaseConfig.dumpImportJobMemoryRequirement "${dumpImportJobMemoryRequirement:-}"
add_set_string databaseConfig.backupJobCPURequirement "${backupJobCPURequirement:-}"
add_set_string databaseConfig.backupJobMemoryRequirement "${backupJobMemoryRequirement:-}"
add_set_string databaseConfig.backupEnabled "${backupEnabled:-}"
add_set_string databaseConfig.showDocument "${showDocument:-}"
add_set_string databaseConfig.managedDbEnabled "${managedDbEnabled:-}"
add_set_string databaseConfig.fileImportEnabled "${fileImportEnabled:-}"
add_set_string databaseConfig.currencySymbol "${currencySymbol:-}"
add_set_string databaseConfig.forcedStorageClassName "${forcedStorageClassName:-}"
add_set_string databaseConfig.storageMaxSize "${storageMaxSize:-}"
add_set_string databaseConfig.customScripts "${customScripts:-}"
add_set_string databaseConfig.eventAnalysisEnabled "${eventAnalysisEnabled:-}"
add_set_string databaseConfig.eventAnalysisUrl "${eventAnalysisUrl:-}"
add_set_string databaseConfig.eventAnalysisModelId "${eventAnalysisModelId:-}"
add_set_string databaseConfig.eventAnalysisFastGPTKey "${eventAnalysisFastGPTKey:-}"

adopt_namespaced_resource() {
  local namespace="$1"
  local kind="$2"
  local name="$3"
  if kubectl -n "${namespace}" get "${kind}" "${name}" >/dev/null 2>&1; then
    echo "Adopting ${kind} ${namespace}/${name}..."
    kubectl -n "${namespace}" label "${kind}" "${name}" app.kubernetes.io/managed-by=Helm --overwrite >/dev/null 2>&1 || true
    kubectl -n "${namespace}" annotate "${kind}" "${name}" meta.helm.sh/release-name="${RELEASE_NAME}" meta.helm.sh/release-namespace="${RELEASE_NAMESPACE}" --overwrite >/dev/null 2>&1 || true
  fi
}

adopt_cluster_resource() {
  local kind="$1"
  local name="$2"
  if kubectl get "${kind}" "${name}" >/dev/null 2>&1; then
    echo "Adopting ${kind} ${name}..."
    kubectl label "${kind}" "${name}" app.kubernetes.io/managed-by=Helm --overwrite >/dev/null 2>&1 || true
    kubectl annotate "${kind}" "${name}" meta.helm.sh/release-name="${RELEASE_NAME}" meta.helm.sh/release-namespace="${RELEASE_NAMESPACE}" --overwrite >/dev/null 2>&1 || true
  fi
}

echo "Checking and adopting existing resources..."
if kubectl get namespace "${RELEASE_NAMESPACE}" >/dev/null 2>&1; then
  kubectl label namespace "${RELEASE_NAMESPACE}" app.kubernetes.io/managed-by=Helm --overwrite >/dev/null 2>&1 || true
  kubectl annotate namespace "${RELEASE_NAMESPACE}" meta.helm.sh/release-name="${RELEASE_NAME}" meta.helm.sh/release-namespace="${RELEASE_NAMESPACE}" --overwrite >/dev/null 2>&1 || true

  adopt_namespaced_resource "${RELEASE_NAMESPACE}" serviceaccount cluster-version-reader
  adopt_namespaced_resource "${RELEASE_NAMESPACE}" configmap database-frontend-config
  adopt_namespaced_resource "${RELEASE_NAMESPACE}" service database-frontend
  adopt_namespaced_resource "${RELEASE_NAMESPACE}" deployment database-frontend
  adopt_namespaced_resource "${RELEASE_NAMESPACE}" ingress database-frontend
fi

adopt_namespaced_resource app-system apps.app.sealos.io database
adopt_cluster_resource clusterrole cluster-version-reader
adopt_cluster_resource clusterrolebinding cluster-version-reader-rolebinding

SERVICE_NAME="database-frontend"
USER_VALUES_PATH="/root/.sealos/cloud/values/core/${SERVICE_NAME}-values.yaml"

if [ ! -f "${USER_VALUES_PATH}" ]; then
  mkdir -p "$(dirname "${USER_VALUES_PATH}")"
  cp "./charts/database-frontend/database-frontend-values.yaml" "${USER_VALUES_PATH}"
fi

HELM_ARGS="${AUTO_CONFIG_HELM_OPTS} ${HELM_OPTIONS} ${HELM_OPTS}"

echo "Deploying Helm chart..."
helm upgrade -i "${RELEASE_NAME}" -n "${RELEASE_NAMESPACE}" --create-namespace "${CHART_PATH}" \
  -f "./charts/database-frontend/values.yaml" \
  -f "${USER_VALUES_PATH}" \
  ${HELM_ARGS}
