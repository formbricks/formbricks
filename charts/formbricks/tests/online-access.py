#!/usr/bin/env python3
"""Verify hook admission, RBAC and garbage collection in a disposable Kind cluster.

Requires kind, kubectl, Helm, Node and installed workspace dependencies. Never uses
an existing kubeconfig or application image. This is not an upgrade rehearsal.
"""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[3]


def run(args, stdin=None):
    result = subprocess.run(args, input=stdin, text=True, capture_output=True, cwd=ROOT)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout


def verify(kube, directory):
    namespace = "online-access-test"
    fixture = (ROOT / "charts/formbricks/tests/online-upgrade.sh").read_text()
    values = fixture.split("<<'VALUES'\n")[1].split("\nVALUES")[0]
    values_file = directory / "values.yaml"
    values_file.write_text(values)
    manifest = run([
        "helm", "template", "fixture", "charts/formbricks", "-f", str(values_file),
        "--namespace", namespace, "--is-upgrade",
        "--set", "global.postgresql.auth.password=fixture",
        "--set", "global.redis.password=fixture",
    ])
    docs = json.loads(run([
        "node", "-e",
        "const fs=require('node:fs'); const yaml=require('js-yaml'); "
        "process.stdout.write(JSON.stringify(yaml.loadAll(fs.readFileSync(0,'utf8')).filter(Boolean)));",
    ], manifest))
    run(kube + ["create", "namespace", namespace])
    run(kube + ["label", "namespace", namespace, "pod-security.kubernetes.io/enforce=restricted"])
    resources = [
        doc for doc in docs
        if doc["kind"] in ["ServiceAccount", "Role", "RoleBinding", "ConfigMap"]
        and doc["metadata"]["name"] == "formbricks-online"
    ]
    job = next(doc for doc in docs if doc["kind"] == "Job" and doc["metadata"]["name"] == "formbricks-online-finalize")
    # Admission is checked using a dry-run Pod; the fake application digest is never pulled or started.
    job["spec"]["suspend"] = True
    for resource in resources + [job]:
        resource["metadata"]["namespace"] = namespace
    run(kube + ["apply", "-f", "-"], json.dumps({"apiVersion": "v1", "kind": "List", "items": resources + [job]}))
    pod = {
        "apiVersion": "v1", "kind": "Pod",
        "metadata": {"name": "coordinator-admission", "namespace": namespace},
        "spec": job["spec"]["template"]["spec"],
    }
    run(kube + ["apply", "--dry-run=server", "-f", "-"], json.dumps(pod))
    print("Restricted PodSecurity admits the rendered coordinator pod.")
    account = kube + ["--as", f"system:serviceaccount:{namespace}:formbricks-online", "-n", namespace]
    assert run(account + ["auth", "can-i", "get", "pods/envoy:19000", "--subresource=proxy"]).strip() == "yes"
    denied = subprocess.run(account + ["auth", "can-i", "get", "pods/other:19000", "--subresource=proxy"], text=True, capture_output=True)
    assert denied.returncode == 1 and denied.stdout.strip() == "no"
    print("Proxy access permits only the configured ingress resource name.")
    actual = json.loads(run(kube + ["-n", namespace, "get", "job", "formbricks-online-finalize", "-o", "json"]))
    owner = {"apiVersion": "batch/v1", "kind": "Job", "name": actual["metadata"]["name"], "uid": actual["metadata"]["uid"]}
    for kind in ["serviceaccount", "role", "rolebinding", "configmap"]:
        resource = json.loads(run(account + ["get", kind, "formbricks-online", "-o", "json"]))
        patch = {"metadata": {"resourceVersion": resource["metadata"]["resourceVersion"], "ownerReferences": [owner]}}
        run(account + ["patch", kind, "formbricks-online", "--type", "merge", "-p", json.dumps(patch)])
    print("Coordinator ownership updates need no escalation or bind privileges.")
    run(kube + ["-n", namespace, "delete", "job", "formbricks-online-finalize", "--wait=true"])
    run(kube + [
        "-n", namespace, "wait", "--for=delete", "serviceaccount/formbricks-online", "role/formbricks-online",
        "rolebinding/formbricks-online", "configmap/formbricks-online", "--timeout=30s",
    ])
    print("Hook deletion collects the ServiceAccount, Role, RoleBinding and ConfigMap.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", default="kind", help="Path to the Kind executable")
    args = parser.parse_args()
    name = f"formbricks-online-access-{uuid.uuid4().hex[:8]}"
    with tempfile.TemporaryDirectory(prefix="formbricks-online-access-") as temp:
        directory = Path(temp)
        config = directory / "kubeconfig"
        try:
            run([args.kind, "create", "cluster", "--name", name, "--kubeconfig", str(config), "--wait", "60s"])
            verify(["kubectl", "--kubeconfig", str(config)], directory)
        finally:
            run([args.kind, "delete", "cluster", "--name", name, "--kubeconfig", str(config)])


if __name__ == "__main__":
    main()
