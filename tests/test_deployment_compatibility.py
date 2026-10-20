"""Exercise upgrade identity and ownership guards without contacting a cluster."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ("main", "release-v5.1")


class DeploymentCompatibility(unittest.TestCase):
    def test_existing_values_and_resource_identity(self):
        for source in SOURCES:
            with self.subTest(source=source), tempfile.TemporaryDirectory() as temp:
                values = Path(temp) / "values.yaml"
                values.write_text('dbproviderConfig:\n  cloudDomain: upgrade.example\n'
                                  '  metricsUrl: "http://preserved-metrics:8481/select/0/prometheus"\n'
                                  '  currencySymbol: "usd"\n')
                result = subprocess.run([
                    "helm", "template", "dbprovider-frontend",
                    str(ROOT / source / "database/deploy/charts/database-frontend"),
                    "--namespace", "dbprovider-frontend", "-f", str(values),
                ], text=True, capture_output=True, check=True).stdout
                self.assertNotIn("currencySymbol", result)
                self.assertNotIn("CURRENCY_SYMBOL", result)
                self.assertIn("dbprovider.upgrade.example", result)
                self.assertIn("http://preserved-metrics:8481/select/0/prometheus", result)
                self.assertIn("METRICS_URL", result)
                self.assertNotIn("MONITOR_URL", result)
                self.assertNotIn("database-monitor", result)
                self.assertIn("name: dbprovider-frontend-config", result)
                self.assertIn("name: dbprovider\n", result)
                self.assertIn("namespace: dbprovider-frontend", result)
                if source == "main":
                    self.assertIn("    database:\n", result)

    def run_installer(self, source, ownership):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            calls = directory / "calls.jsonl"
            mock = '''#!/usr/bin/env python3
import json, os, pathlib, sys
with open(os.environ["MOCK_CALLS"], "a") as f:
    f.write(json.dumps([pathlib.Path(sys.argv[0]).name, *sys.argv[1:]]) + "\\n")
if pathlib.Path(sys.argv[0]).name == "kubectl":
    if any(".metadata.labels" in arg for arg in sys.argv):
        print(os.environ["MOCK_OWNERSHIP"], end="")
'''
            for command in ("kubectl", "helm"):
                executable = directory / command
                executable.write_text(mock)
                executable.chmod(0o755)
            tools = directory / "tools.sh"
            tools.write_text("\n".join(
                f"{name}() {{ :; }}" for name in (
                    "ensure_global_values_ready_for_component", "fetch_configmap_data_key",
                    "global_http_disable_https", "global_http_external_url", "info",
                    "read_cert_tls_reject_unauthorized", "read_jwt_internal",
                    "read_yaml_file_path", "warn",
                )
            ))
            values = directory / "existing.yaml"
            content = "dbproviderConfig:\n  metricsUrl: http://preserved-metrics:8481/select/0/prometheus\n"
            values.write_text(content)
            env = os.environ.copy()
            # Ensure host/session variables cannot influence fixture deployment identity.
            for key in ("RELEASE_NAME", "RELEASE_NAMESPACE", "HELM_OPTS", "HELM_OPTIONS"):
                env.pop(key, None)
            env.update(PATH=f"{directory}:{env['PATH']}", MOCK_CALLS=str(calls),
                       MOCK_OWNERSHIP=ownership, TOOLS_FILE=str(tools),
                       USER_VALUES_PATH=str(values))
            deploy = ROOT / source / "database/deploy"
            result = subprocess.run(["bash", "database-frontend-entrypoint.sh"],
                                    cwd=deploy, env=env, text=True, capture_output=True)
            self.assertEqual(values.read_text(), content)
            return result, [json.loads(line) for line in calls.read_text().splitlines()]

    def test_upgrade_uses_existing_release_without_reassigning_ownership(self):
        for source in SOURCES:
            with self.subTest(source=source):
                result, calls = self.run_installer(
                    source, "Helm|dbprovider-frontend|dbprovider-frontend")
                self.assertEqual(result.returncode, 0, result.stderr)
                helm = [call for call in calls if call[0] == "helm"]
                self.assertEqual(len(helm), 1)
                self.assertEqual(helm[0][1:6],
                                 ["upgrade", "-i", "dbprovider-frontend", "-n", "dbprovider-frontend"])
                self.assertFalse(any("annotate" in call or "label" in call for call in calls))

    def test_foreign_owned_resources_fail_before_mutation_or_helm(self):
        for source in SOURCES:
            with self.subTest(source=source):
                result, calls = self.run_installer(source, "Helm|another-release|another-ns")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Refusing to adopt", result.stderr)
                self.assertFalse(any(call[0] == "helm" or "annotate" in call
                                     or "label" in call for call in calls))

    def test_unmanaged_legacy_resources_are_adopted(self):
        for source in SOURCES:
            with self.subTest(source=source):
                result, calls = self.run_installer(source, "||")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(any("annotate" in call for call in calls))
                self.assertTrue(any(call[0] == "helm" for call in calls))


if __name__ == "__main__":
    unittest.main()
