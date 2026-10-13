#!/usr/bin/env bash
set -euo pipefail
chart="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/values.yaml" <<'VALUES'
formbricks:
  webappUrl: https://fixture.example.com
autoscaling:
  enabled: false
deployment:
  strategy: null
  replicas: 2
  terminationGracePeriodSeconds: 300
  image:
    digest: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  probes:
    readinessProbe:
      httpGet: {path: /health/ready, port: 3000}
upgrade:
  mode: online
  online:
    sessionAffinity: true
    ingress: {selector: app=envoy, cluster: fixture}
    dependencies:
      - kind: deployments
        name: hub
        image: ghcr.io/formbricks/hub@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
hub:
  replicas: 2
  image:
    digest: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
cube:
  replicas: 2
  image:
    digest: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  env:
    CUBEJS_CACHE_AND_QUEUE_DRIVER: cubestore
VALUES
# Argo renders Helm as an install. Assert its phases independently from Helm's upgrade hooks.
for controller in helm argo; do
  args=(--set authzed.initialization.enabled=true)
  if [[ "$controller" == helm ]]; then args+=(--is-upgrade); fi
  helm template fixture "$chart" -f "$tmp/values.yaml" "${args[@]}" \
    --set global.postgresql.auth.password=fixture --set global.redis.password=fixture > "$tmp/$controller.yaml"
done
node - "$tmp" <<'JS'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const yaml = require('js-yaml');
const dir = process.argv[2];
for (const controller of ['helm', 'argo']) {
  const docs = yaml.loadAll(fs.readFileSync(`${dir}/${controller}.yaml`, 'utf8')).filter(Boolean);
  const prepare = docs.find(d => d.kind === 'Job' && d.metadata.name === 'formbricks-online-prepare');
  const finalize = docs.find(d => d.kind === 'Job' && d.metadata.name === 'formbricks-online-finalize');
  const annotation = controller === 'helm' ? 'helm.sh/hook' : 'argocd.argoproj.io/hook';
  assert.equal(prepare.metadata.annotations[annotation], controller === 'helm' ? 'pre-upgrade' : 'PreSync');
  assert.equal(finalize.metadata.annotations[annotation], controller === 'helm' ? 'post-upgrade' : 'PostSync');
  const primary = docs.find(d => d.kind === 'Deployment' && d.metadata.name === 'formbricks');
  const cm = docs.find(d => d.kind === 'ConfigMap' && d.metadata.name === 'formbricks-online');
  assert.deepEqual(JSON.parse(cm.data['deployment.json']).spec.template, primary.spec.template);
  assert.deepEqual(primary.spec.strategy.rollingUpdate, {maxSurge: 1, maxUnavailable: 0});
  for (const component of ['hub', 'cube']) {
    const workload = docs.find(d => d.kind === 'Deployment' && d.metadata.labels?.['app.kubernetes.io/component'] === component);
    assert.deepEqual(workload.spec.strategy.rollingUpdate, {maxSurge: 1, maxUnavailable: 0});
  }
  assert.equal(primary.spec.template.spec.containers[0].env.find(e => e.name === 'SKIP_STARTUP_MIGRATION').value, 'true');
  assert.equal(docs.some(d => d.kind === 'Job' && d.metadata.name === 'formbricks-authzed-initialize'), false);
  assert.equal(docs.some(d => d.kind === 'Deployment' && d.metadata.name.endsWith('online-surge')), false);
  assert.equal(docs.some(d => d.kind === 'ClusterRole' && d.metadata.name.includes('online')), false);
}
JS
if helm template fixture "$chart" -f "$tmp/values.yaml" --set deployment.replicas=1 > "$tmp/rejected" 2>&1; then
  echo 'single-replica online upgrade was accepted' >&2; exit 1
fi
if helm template fixture "$chart" -f "$tmp/values.yaml" --set upgrade.mode=onlien > "$tmp/rejected" 2>&1; then
  echo 'unknown upgrade mode was accepted' >&2; exit 1
fi
if helm template fixture "$chart" -f "$tmp/values.yaml" --set deployment.env.FORMBRICKS_UPGRADE_MODE=maintenance > "$tmp/rejected" 2>&1; then
  echo 'compatibility mode override was accepted' >&2; exit 1
fi
printf '%s\n' 'Online Helm and Argo render contracts passed.'
