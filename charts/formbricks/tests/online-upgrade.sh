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
  nodeSelector: {pool: application}
  tolerations: [{key: application, operator: Exists, effect: NoSchedule}]
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
    existingInstallation: true
    sessionAffinity: true
    ingress: {selector: app=envoy, cluster: fixture, proxyResourceNames: ["envoy:19000"]}
    dependencies:
      - kind: deployments
        name: hub
        image: ghcr.io/formbricks/hub@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
hub:
  replicas: 2
  image:
    digest: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
# Cube keeps the chart default: one replica with the in-memory driver (ENG-3955).
cube:
  image:
    digest: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
VALUES
# Argo renders Helm as an install. Assert its phases independently from Helm's upgrade hooks.
for controller in helm argo; do
  args=(--set authzed.initialization.enabled=true --set upgrade.online.controller="$controller")
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
  assert.equal(primary.spec.template.spec.containers[0].env.find(e => e.name === 'BULLMQ_WORKER_ENABLED').value, '1');
  assert.equal(JSON.parse(cm.data['config.json']).jobDrainTimeoutSeconds, 180);
  for (const job of [prepare, finalize]) {
    const pod = job.spec.template.spec;
    const container = pod.containers[0];
    assert.equal(container.securityContext.runAsNonRoot, true);
    assert.equal(container.securityContext.allowPrivilegeEscalation, false);
    assert.deepEqual(container.securityContext.capabilities.drop, ['ALL']);
    assert.equal(container.securityContext.seccompProfile.type, 'RuntimeDefault');
    assert.deepEqual(container.resources, primary.spec.template.spec.containers[0].resources);
    assert.equal(pod.securityContext.fsGroup, 1001);
    assert.deepEqual(pod.nodeSelector, primary.spec.template.spec.nodeSelector);
    assert.deepEqual(pod.tolerations, primary.spec.template.spec.tolerations);
    assert.ok(container.volumeMounts.some(m => m.mountPath.endsWith('/.prisma-migrations')));
    assert.equal(job.spec.backoffLimit, 3);
  }
  const role = docs.find(d => d.kind === 'Role' && d.metadata.name === 'formbricks-online');
  const workloadPatches = role.rules.filter(r => r.apiGroups.includes('apps') && r.verbs.includes('patch'));
  assert.equal(workloadPatches.length, 1);
  assert.deepEqual(workloadPatches[0].resourceNames, ['formbricks']);
  const proxyRule = role.rules.find(r => r.resources.includes('pods/proxy'));
  assert.deepEqual(proxyRule.resourceNames, ['envoy:19000']);
  for (const rule of role.rules.filter(r => r.apiGroups.includes('rbac.authorization.k8s.io'))) {
    assert.deepEqual(rule.resourceNames, ['formbricks-online']);
  }
  assert.equal(docs.some(d => d.kind === 'Job' && d.metadata.name === 'formbricks-authzed-initialize'), false);
  assert.equal(docs.some(d => d.kind === 'Deployment' && d.metadata.name.endsWith('online-surge')), false);
  assert.equal(docs.some(d => d.kind === 'ClusterRole' && d.metadata.name.includes('online')), false);
}
JS
# Each case must fail on its own rule. Without the passwords every render fails in the PostgreSQL subchart
# instead, which would hide a removed rule.
rejects() {
  local expected="$1"; shift
  if helm template fixture "$chart" -f "$tmp/values.yaml" \
    --set global.postgresql.auth.password=fixture --set global.redis.password=fixture "$@" > "$tmp/rejected" 2>&1; then
    echo "accepted: $*" >&2; exit 1
  fi
  if ! grep -qF "$expected" "$tmp/rejected"; then
    echo "rejected without \"$expected\": $*" >&2; cat "$tmp/rejected" >&2; exit 1
  fi
}
rejects 'requires fixed deployment.replicas >= 2' --is-upgrade --set deployment.replicas=1
rejects 'upgrade.mode must be online or maintenance' --set upgrade.mode=onlien
rejects 'Online mode owns FORMBRICKS_UPGRADE_MODE' --is-upgrade --set deployment.env.FORMBRICKS_UPGRADE_MODE=maintenance
rejects 'requires target web workers enabled' --is-upgrade --set deployment.env.BULLMQ_WORKER_ENABLED=0
rejects 'supports helm upgrade only' # a fresh Helm install
rejects 'requires an existing stable 6.0 installation' \
  --set upgrade.online.controller=argo --set upgrade.online.existingInstallation=false
rejects 'requires fixed hub.replicas >= 2' --is-upgrade --set hub.replicas=1
# More than one Cube replica still needs Cube Store (ENG-3955).
rejects 'CUBEJS_CACHE_AND_QUEUE_DRIVER=memory is only supported when cube.replicas=1' --is-upgrade --set cube.replicas=2
printf '%s\n' 'Online Helm and Argo render contracts passed.'
