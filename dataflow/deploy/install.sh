#!/usr/bin/env bash
set -euo pipefail
umask 077

timestamp() {
  date +"%Y-%m-%d %T"
}

info() {
  local flag
  flag="$(timestamp)"
  echo -e "\033[36m INFO [$flag] >> $* \033[0m"
}

warn() {
  local flag
  flag="$(timestamp)"
  echo -e "\033[33m WARN [$flag] >> $* \033[0m"
}

error() {
  local flag
  flag="$(timestamp)"
  echo -e "\033[31m ERROR [$flag] >> $* \033[0m"
  exit 1
}

RELEASE_NAME="${RELEASE_NAME:-dataflow}"
NAMESPACE="${NAMESPACE:-dataflow-system}"
HELM_OPTS="${HELM_OPTS:-}"
DEFAULT_VALUES_FILE="./charts/dataflow/dataflow-values.yaml"
USER_VALUES_DIR="${DATAFLOW_USER_VALUES_DIR:-/root/.sealos/cloud/values/apps/dataflow}"
USER_VALUES_FILE="${USER_VALUES_DIR}/dataflow-values.yaml"

get_sealos_config() {
  local key=$1
  if [ "$key" = cloudDomain ] && [ -n "${SEALOS_CLOUD_DOMAIN:-}" ]; then
    printf '%s' "$SEALOS_CLOUD_DOMAIN"
    return
  fi
  kubectl get configmap sealos-config -n sealos-system -o "jsonpath={.data.${key}}"
}

decode_base64() {
  local raw=$1
  local decoded=""

  if decoded="$(printf '%s' "${raw}" | base64 --decode 2>/dev/null)"; then
    printf '%s' "${decoded}"
    return 0
  fi

  if decoded="$(printf '%s' "${raw}" | base64 -d 2>/dev/null)"; then
    printf '%s' "${decoded}"
    return 0
  fi

  return 1
}

get_secret_data() {
  local secret_name=$1
  local key=$2
  local encoded=""

  encoded="$(kubectl get secret "${secret_name}" -n "${NAMESPACE}" -o "jsonpath={.data.${key}}" 2>/dev/null || true)"
  [ -n "${encoded}" ] || return 1

  decode_base64 "${encoded}"
}

ensure_user_values_file() {
  mkdir -p "${USER_VALUES_DIR}"

  if [ ! -f "${USER_VALUES_FILE}" ]; then
    if helm status "${RELEASE_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
      # Recover existing effective values before a combined-package upgrade.
      local values_tmp
      values_tmp="$(mktemp "${USER_VALUES_DIR}/.values.XXXXXX")"
      if ! helm get values "${RELEASE_NAME}" -n "${NAMESPACE}" -a -o yaml > "${values_tmp}"; then
        rm -f "${values_tmp}"
        error "Cannot read existing release values; refusing to reset configuration"
      fi
      mv "${values_tmp}" "${USER_VALUES_FILE}"
      info "Recovered existing release values at ${USER_VALUES_FILE}"
    else
      cp "${DEFAULT_VALUES_FILE}" "${USER_VALUES_FILE}"
      info "Generated default user values at ${USER_VALUES_FILE}"
    fi
    return 0
  fi

  info "Using user values from ${USER_VALUES_FILE}"
}

sealos_cloud_domain="$(get_sealos_config cloudDomain || true)"
[ -n "${sealos_cloud_domain}" ] || error "Failed to read sealos-config.data.cloudDomain"

ensure_user_values_file

helm_opts_arr=()
if [ -n "${HELM_OPTS}" ]; then
  # shellcheck disable=SC2206
  helm_opts_arr=(${HELM_OPTS})
fi

global_values_args=()
GLOBAL_VALUES_FILE="/root/.sealos/cloud/values/global.yaml"
if [ -f "$GLOBAL_VALUES_FILE" ]; then
  global_values_args=(-f "$GLOBAL_VALUES_FILE")
fi


# Resolve the actual Secret selected by Helm, including existingSecret and
# fullnameOverride, without requiring a YAML parser on the target host.
configured_secret_name="$(helm template "${RELEASE_NAME}" charts/dataflow \
  -n "${NAMESPACE}" -f "${DEFAULT_VALUES_FILE}" -f "${USER_VALUES_FILE}" \
  "${global_values_args[@]+"${global_values_args[@]}"}" \
  "${helm_opts_arr[@]+"${helm_opts_arr[@]}"}" \
  --show-only templates/deployment.yaml | awk '
    /- name: WHODB_SESSION_ENCRYPTION_KEY/ { session = 1; next }
    session && /name:/ { print $2; session = 0 }
  ')"
[ -n "${configured_secret_name}" ] || error "Cannot resolve runtime secret from chart"

session_key=""
session_key_source="generated"
existing_secret_name=""
if kubectl get secret "${configured_secret_name}" -n "${NAMESPACE}" >/dev/null 2>&1; then
  existing_secret_name="${configured_secret_name}"
fi

if [ -n "${existing_secret_name}" ]; then
  info "Found existing secret ${existing_secret_name}, trying to reuse WHODB_SESSION_ENCRYPTION_KEY"
  session_key="$(get_secret_data "${existing_secret_name}" "WHODB_SESSION_ENCRYPTION_KEY" || true)"

  if [ -n "${session_key}" ]; then
    session_key_source="secret:${existing_secret_name}"
  fi
fi

if [ -n "${existing_secret_name}" ] && [ -z "${session_key}" ]; then
  error "Existing runtime secret has no session key; refusing to rotate it during upgrade"
fi

if [ -z "${session_key}" ]; then
  if helm status "${RELEASE_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
    error "Existing release has no readable runtime secret; configure it before upgrading"
  fi
  warn "WHODB_SESSION_ENCRYPTION_KEY not found in existing secret, generating a new one"
  session_key="$(openssl rand -hex 16)"
  session_key_source="generated"
fi

info "Session key source: ${session_key_source}"


helm_set_args=(
  --set-string "cloudDomain=${sealos_cloud_domain}"
  --set-string "session.encryptionKey=${session_key}"
)

if [ -n "${DATAFLOW_IMAGE_REPOSITORY:-}" ]; then
  helm_set_args+=(--set-string "image.repository=${DATAFLOW_IMAGE_REPOSITORY}")
fi
if [ -n "${DATAFLOW_IMAGE_TAG:-}" ]; then
  helm_set_args+=(--set-string "image.tag=${DATAFLOW_IMAGE_TAG}")
fi


info "Installing chart charts/dataflow into namespace ${NAMESPACE}"
helm upgrade -i "${RELEASE_NAME}" -n "${NAMESPACE}" --create-namespace charts/dataflow \
  -f "${DEFAULT_VALUES_FILE}" \
  -f "${USER_VALUES_FILE}" \
  "${global_values_args[@]+"${global_values_args[@]}"}" \
  "${helm_set_args[@]}" \
  "${helm_opts_arr[@]+"${helm_opts_arr[@]}"}"
