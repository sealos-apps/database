#!/usr/bin/env bash
set -euo pipefail
source_tree="${1:?Usage: prepare-bundle.sh <main|release-v5.1> <output-dir> <database-image> <dataflow-image> <tag>}"
output_dir="${2:?output directory is required}"
database_image="${3:?database image is required}"
dataflow_image="${4:?dataflow image is required}"
tag="${5:?tag is required}"
case "$source_tree" in main|release-v5.1) ;; *) echo "Unsupported source: $source_tree" >&2; exit 1 ;; esac
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Never replace an existing directory: callers allocate a fresh staging path.
mkdir "$output_dir"
cp "${repo_dir}/deploy/Kubefile" "${repo_dir}/deploy/install.sh" "$output_dir/"
mkdir "$output_dir/database" "$output_dir/dataflow" "$output_dir/charts"
cp -R "${repo_dir}/${source_tree}/database/deploy/charts/database-frontend" "$output_dir/charts/"
cp "${repo_dir}/${source_tree}/database/deploy/database-frontend-entrypoint.sh" "$output_dir/database/"
cp -R "${repo_dir}/dataflow/deploy/charts/dataflow" "$output_dir/charts/"
# Sealos v5.1.2 discovers charts only under the package-root charts directory.
# Preserve both installers' relative paths without duplicating chart contents.
ln -s ../charts "$output_dir/database/charts"
ln -s ../charts "$output_dir/dataflow/charts"
cp "${repo_dir}/dataflow/deploy/install.sh" "$output_dir/dataflow/"
# Pin both runtime references in the staged package, never in source defaults.
ruby -ryaml -e '  p = ARGV[0]; d = YAML.load_file(p); d["image"] = ARGV[1]; File.write(p, YAML.dump(d))' "$output_dir/database/charts/database-frontend/values.yaml" "${database_image}:${tag}"
ruby -ryaml -e '  p = ARGV[0]; d = YAML.load_file(p); d["image"]["repository"] = ARGV[1]; d["image"]["tag"] = ARGV[2]; File.write(p, YAML.dump(d))' "$output_dir/dataflow/charts/dataflow/values.yaml" "$dataflow_image" "$tag"
# Pass pins independently of persisted values recovered from an older release.
printf 'export DATAFLOW_IMAGE_REPOSITORY=%q\nexport DATAFLOW_IMAGE_TAG=%q\n' "$dataflow_image" "$tag" > "$output_dir/dataflow/image.env"
printf 'export DATABASE_RUNTIME_IMAGE=%q\n' "${database_image}:${tag}" > "$output_dir/database/image.env"
