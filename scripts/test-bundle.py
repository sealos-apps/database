"""Validate packaging and upgrades using fake Helm/kubectl, without a cluster."""
import json
import os
from pathlib import Path
import subprocess
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.work = Path(self.temp.name)
        self.bin = self.work / 'bin'
        self.bin.mkdir()
        mock = '''#!/usr/bin/env python3
import base64, json, os, subprocess, sys
from pathlib import Path
args = sys.argv[1:]
tool = Path(sys.argv[0]).name
if tool == 'kubectl':
    if args[:2] == ['get', 'configmap']:
        print('example.test', end='')
    elif args[:2] == ['get', 'secret'] and args[2] == ('custom-runtime' if os.environ['SCENARIO'] == 'custom-secret' else 'dataflow-secret') and os.environ['SCENARIO'] != 'fresh':
        if any('jsonpath' in arg for arg in args):
            if os.environ['SCENARIO'] != 'missing-key':
                print(base64.b64encode(b'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').decode(), end='')
    else:
        sys.exit(1)
elif args[0] == 'template':
    sys.exit(subprocess.call([os.environ['REAL_HELM']] + args))
elif args[0] == 'status':
    sys.exit(1 if os.environ['SCENARIO'] == 'fresh' else 0)
elif args[:2] == ['get', 'values']:
    if os.environ['SCENARIO'] == 'unreadable-values':
        sys.exit(1)
    if os.environ['SCENARIO'] == 'custom-secret':
        print('secret:\\n  existingSecret: custom-runtime')
    print('metadata:\\n  native:\\n    enabled: false\\n  dsn: existing-test-dsn\\nimage:\\n  repository: old/image\\n  tag: old')
elif args[0] == 'upgrade':
    Path(os.environ['CALLS']).write_text(json.dumps(args))
else:
    sys.exit(1)
'''
        for name in ('helm', 'kubectl'):
            path = self.bin / name
            path.write_text(mock)
            path.chmod(0o755)
        self.env = dict(os.environ, PATH=f'{self.bin}:{os.environ["PATH"]}',
                        CALLS=str(self.work / 'calls.json'), REAL_HELM=shutil.which('helm'),
                        DATAFLOW_USER_VALUES_DIR=str(self.work / 'values'),
                        DATAFLOW_IMAGE_REPOSITORY='ghcr.io/test/database/dataflow',
                        DATAFLOW_IMAGE_TAG='main-test', HELM_OPTS='')

    def install(self, scenario):
        return subprocess.run(['bash', 'install.sh'], cwd=ROOT / 'dataflow/deploy',
                              env=dict(self.env, SCENARIO=scenario),
                              capture_output=True, text=True)

    def test_existing_configuration_and_key_preserved_with_new_image(self):
        result = self.install('existing')
        self.assertEqual(result.returncode, 0, result.stderr)
        values = (self.work / 'values/dataflow-values.yaml').read_text()
        self.assertIn('existing-test-dsn', values)
        args = json.loads((self.work / 'calls.json').read_text())
        self.assertIn('session.encryptionKey=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', args)
        self.assertIn('image.repository=ghcr.io/test/database/dataflow', args)
        self.assertIn('image.tag=main-test', args)

    def test_custom_existing_secret_preserved(self):
        result = self.install('custom-secret')
        self.assertEqual(result.returncode, 0, result.stderr)
        args = json.loads((self.work / 'calls.json').read_text())
        self.assertIn('session.encryptionKey=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', args)

    def test_missing_existing_key_stops_before_upgrade(self):
        result = self.install('missing-key')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.work / 'calls.json').exists())

    def test_unreadable_existing_values_stops_before_upgrade(self):
        result = self.install('unreadable-values')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.work / 'calls.json').exists())
        self.assertFalse((self.work / 'values/dataflow-values.yaml').exists())

    def test_fresh_install_registers_app(self):
        result = self.install('fresh')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('enabled: true', (self.work / 'values/dataflow-values.yaml').read_text())
        self.assertTrue((self.work / 'calls.json').exists())

    def test_both_source_packages_render_both_images_and_app(self):
        for source in ('main', 'release-v5.1'):
            bundle = self.work / source
            subprocess.run(['bash', str(ROOT / 'scripts/prepare-bundle.sh'), source,
                            str(bundle), 'ghcr.io/test/database/frontend',
                            'ghcr.io/test/database/dataflow', f'{source}-test'], check=True)
            self.assertEqual({p.name for p in (bundle / 'charts').iterdir()},
                             {'database-frontend', 'dataflow'})
            for app, chart, namespace in (('database', 'database-frontend', 'database-frontend'),
                                          ('dataflow', 'dataflow', 'dataflow-system')):
                chart_dir = bundle / app / 'charts' / chart
                rendered = subprocess.check_output(
                    ['helm', 'template', chart, str(chart_dir), '-n', namespace,
                     '-f', str(chart_dir / f'{chart}-values.yaml')], text=True)
                image = 'frontend' if app == 'database' else 'dataflow'
                self.assertIn(f'ghcr.io/test/database/{image}:{source}-test', rendered)
                if app == 'dataflow':
                    self.assertIn('kind: App', rendered)
                    self.assertIn('http://dataflow.dataflow-system.svc.cluster.local:8080/healthz', rendered)

    def test_combined_installer_stops_if_dataflow_fails(self):
        bundle = self.work / 'bundle'
        bundle.mkdir()
        (bundle / 'dataflow').mkdir()
        (bundle / 'database').mkdir()
        (bundle / 'dataflow/image.env').write_text('export DATAFLOW_IMAGE_TAG=main-test\n')
        (bundle / 'dataflow/install.sh').write_text('exit 42\n')
        (bundle / 'database/image.env').write_text('exit 99\n')
        installer = bundle / 'install.sh'
        installer.write_text((ROOT / 'deploy/install.sh').read_text())
        result = subprocess.run(['bash', str(installer)], env=self.env)
        self.assertEqual(result.returncode, 42)

    def test_combined_installer_isolates_release_and_helm_options(self):
        bundle = self.work / 'bundle'
        bundle.mkdir()
        for app in ('dataflow', 'database'):
            (bundle / app).mkdir()
        (bundle / 'database/image.env').write_text('export DATABASE_RUNTIME_IMAGE=ghcr.io/test/database/frontend:main-test\n')
        (bundle / 'dataflow/image.env').write_text('export DATAFLOW_IMAGE_TAG=main-test\n')
        (bundle / 'dataflow/install.sh').write_text(
            'printf "%s|%s|%s\\n" "$RELEASE_NAME" "$NAMESPACE" "$HELM_OPTS" >> "$CALLS"\n')
        (bundle / 'database/database-frontend-entrypoint.sh').write_text(
            'printf "%s|%s|%s\\n" "$RELEASE_NAME" "$RELEASE_NAMESPACE" "$HELM_OPTS" >> "$CALLS"\n')
        installer = bundle / 'install.sh'
        installer.write_text((ROOT / 'deploy/install.sh').read_text())
        env = dict(self.env, RELEASE_NAME='custom-database', RELEASE_NAMESPACE='db-system',
                   HELM_OPTS='--set db=value', DATAFLOW_HELM_OPTS='--set flow=value')
        subprocess.run(['bash', str(installer)], env=env, check=True)
        self.assertEqual((self.work / 'calls.json').read_text().splitlines(),
                         ['dataflow|dataflow-system|--set flow=value',
                          'custom-database|db-system|--set db=value --set-string image=ghcr.io/test/database/frontend:main-test'])


if __name__ == '__main__':
    unittest.main()
