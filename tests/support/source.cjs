const { resolve } = require('node:path');
const { existsSync } = require('node:fs');

const appRoot = resolve('database');
const sourceRoot = resolve(appRoot, 'src');
function sourceFile(channel, relative) {
  const version = channel === 'release-v5.1' ? 'kb08' : 'kb09';
  const implementation = resolve(sourceRoot, 'implementations', version, relative);
  if (existsSync(implementation)) return implementation;
  const currentPage = resolve(sourceRoot, 'implementations/kb09', relative);
  if (relative.startsWith('pages/') && existsSync(currentPage)) return currentPage;
  return resolve(sourceRoot, relative);
}
function originalAlias(id) {
  return id.replace(/^@\/implementations\/kb0[89]\//, '@/');
}
function deploymentRoot(channel) {
  return resolve(channel === 'release-v5.1' ? 'deploy/kubeblocks-0.8' : 'database/deploy');
}
function examplePath(channel) {
  return resolve(appRoot, 'data', channel === 'release-v5.1' ? 'config.kb08.example.yaml' : 'config.example.yaml');
}
module.exports = { deploymentRoot, examplePath, appRoot, sourceRoot, sourceFile, originalAlias };
