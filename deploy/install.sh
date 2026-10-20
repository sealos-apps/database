#!/usr/bin/env bash
set -euo pipefail
bundle_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Separate releases preserve existing resource ownership, values and storage.
(
  cd "${bundle_dir}/dataflow"
  export RELEASE_NAME="${DATAFLOW_RELEASE_NAME:-dataflow}"
  export NAMESPACE="${DATAFLOW_NAMESPACE:-dataflow-system}"
  export HELM_OPTS="${DATAFLOW_HELM_OPTS:-}"
  source image.env
  bash install.sh
)
(
  cd "${bundle_dir}/database"
  source image.env
  export HELM_OPTS="${HELM_OPTS:-} --set-string image=${DATABASE_RUNTIME_IMAGE}"
  bash database-frontend-entrypoint.sh
)
