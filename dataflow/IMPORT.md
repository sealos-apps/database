# DataFlow source import

Source: https://github.com/sealos-apps/dataflow
Branch: main
Commit: a6fbbf53906d2ac9f4a0817af7f50030f90c86d3

Imported tracked files with `git archive`, without a nested Git repository.
The root Database CI builds this source for both Database source channels.
Nested `.github/` workflows are retained as upstream reference; GitHub only runs
workflows in the repository-root `.github/workflows/` directory.
Integration changes after import are tracked in this repository. Keep the
upstream LICENSE and file copyright notices when updating the snapshot.

Local integration changes: `deploy/install.sh` preserves effective release values,
resolves custom runtime Secrets, refuses unsafe session-key rotation, accepts
package image pins and an optional cloud-domain/user-values-directory override.
The local `.gitignore` also re-includes five upstream tracked Go build placeholders
and tool declarations that would otherwise be hidden by ignore rules during import.
