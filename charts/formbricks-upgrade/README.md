# Formbricks v6 upgrade chart

This temporary chart coordinates the database-backed AuthZed authority transition for an existing Formbricks
v5 Helm release. It never installs or owns Formbricks, SpiceDB, credentials, network resources, persistent
storage, or cluster-scoped resources. Uninstall it after a successful cutover or rollback; the permanent
`charts/formbricks` release remains free of temporary coordination objects.

Every Job in this chart runs the immutable, legacy-authoritative bridge image. The v6 candidate digest is bound
into the preparation receipt and plan, but this chart never runs the candidate image. The signed release assistant
orchestrates the permanent chart and this coordinator together; candidate deployment, runtime verification, and
finalization occur through that assistant rather than inside this temporary chart.

## Before installing

The supported default is the checksum-verified `formbricks-upgrade-assistant execute --install-type helm` flow
documented in the [v6 upgrade guide](../../docs/self-hosting/advanced/v6-upgrade-assistant.mdx). It consumes the
release-matched `formbricks-<version>.tgz` and `formbricks-upgrade-<version>.tgz`, snapshots the current release,
and generates phase values internally. If interrupted, use `resume` with the same signed inputs and journal.

Before execution, verify:

- Helm 3.15 or newer is installed so secret-hidden server-side dry runs are available;
- bridge and candidate references are immutable image and embedded-manifest digests;
- the bridge is serving legacy authorization while delivering the durable projection outbox;
- SpiceDB health, schema, outbox, repair, and backup gates pass;
- the permanent release's bridge-image migration Job completed successfully.

Do not start if a candidate migration is destructive or makes the bridge unable to read the database. Contract
migrations belong after the documented rollback-retention window; initial v6 has no contract-migration phase.

Each v6 release publishes this temporary chart as a checksum-signed release asset. Use the version matching the
target Formbricks release; do not run a chart copied from another branch or release. The assistant uses the local
archive so the chart identity is bound to its signed journal.

The remaining commands are a support-only manual recovery interface. Do not substitute them for the assistant's
normal path. The temporary chart is deliberately not published as an independent OCI artifact because that
would not be cryptographically bound to the signed release bundle. A support-directed manual run must use the
checksum-verified local archive downloaded with that bundle:

```sh
helm upgrade --install formbricks-v6-upgrade-1 \
  ./formbricks-upgrade-6.0.0.tgz \
  --namespace formbricks \
  --values upgrade-values.yaml \
  --wait --wait-for-jobs --timeout 30m
```

For an air-gapped installation, use the two local chart archives already verified through the release checksum
file. The assistant requires those archives and does not contact the OCI chart registry.

Keep `generation` fixed for one attempt. Advance `phase` only after the current Job succeeds and the runbook
gate passes. Increment `execution` before rerunning a phase so Kubernetes receives a new immutable Job. Never
change either image, either manifest digest, the protocol version, or the initial schema guard while advancing
that attempt: they form an immutable plan. Never use `--atomic`: Helm cannot safely reverse the database-backed
authority transition.

The signed assistant removes its temporary `migration.mode=external` override after finalization. A support-led
manual cutover must likewise restore the operator's reviewed migration policy before the next ordinary upgrade.

## Support-only manual forward cutover

1. Run `prepare` and copy the returned receipt into `activation.receipt`.
2. Run `audit` and require a clean full-deployment dry run.
3. Verify the permanent release's migration Job ran successfully with the exact bridge digest. The bridge and
   candidate images are built from the same release source and contain the same expand migrations, so the
   candidate must later use external migration mode. Stop if any migration is not bridge-compatible.
4. Pause GitOps reconciliation for the application release. Suspend or remove the HPA, scale the Formbricks
   application Deployment to zero, and wait until no application Pod using the bridge digest remains. Do not
   count this chart's short-lived bridge Job as an application Pod.
5. Set `activation.workloadQuiesced=true`, advance to `activate`, and run the phase. The Job takes the database
   fence, drains to a monotonic outbox watermark, re-audits, and atomically makes SpiceDB authoritative.
   If a previous activate process disappeared after taking the fence, the replacement Job retries only the
   sanitized `authzed_activation_conflict` result until that 15-minute fence expires. The default 35-minute Job
   deadline then retains the activation repository's complete evidence and settlement budget. Schema, graph,
   credential, and transport failures still fail immediately.
6. Deploy the exact candidate digest with the permanent chart. Use external migration mode so neither the chart
   migration Job nor application startup can mutate the database:

   ```yaml
   migration:
     mode: external
   deployment:
     image:
       repository: <candidate-repository>
       digest: sha256:<candidate-digest>
     replicas: 1
   autoscaling:
     enabled: false
   authzed:
     activation:
       installBootstrap:
         enabled: false
       upgradeGate:
         enabled: true
   ```

7. Verify the running Pod's image ID is the recorded candidate digest, its activation runtime check passes, and
   no bridge application Pod remains.
8. From that candidate Pod, run:

   ```sh
   formbricks-authzed activation finalize --receipt <receipt>
   ```

9. Restore the intended replica count/HPA and GitOps reconciliation, then verify protected allow/deny paths.
10. Uninstall this temporary chart and confirm its ConfigMap, Lease, and Jobs are gone.

The activation fence expires after 15 minutes. If the candidate cannot be verified and finalized inside that
window, keep traffic quiesced and follow rollback; do not resume writes or improvise a Helm rollback. Incrementing
`execution` after an interrupted activate Job is safe: the new Job waits for an abandoned active fence, and the
repository treats the exact already-activated receipt as success if the previous response was lost.

## Support-only manual rollback

Rollback remains available only while the exact recorded bridge image is compatible with the database.

1. Pause GitOps, suspend the HPA, scale the candidate application Deployment to zero, and verify no candidate
   application Pod remains.
2. Set `phase=rollback-begin`, `activation.workloadQuiesced=true`, and the active receipt. This establishes the
   rollback fence before changing application images.
3. Restore the exact bridge digest using the permanent chart, with chart and startup migrations disabled and
   without `--atomic`.
4. Verify bridge readiness, the exact image ID, and zero candidate application Pods.
5. Advance to `rollback-complete` with the same receipt. This restores legacy authority and releases the fence.
6. Restore bridge replicas/HPA and GitOps, require a clean relationship audit, then uninstall this chart.

Do not run `rollback-complete` before the bridge application is ready. Do not run a database migration during
rollback.

## Ownership and cleanup

The fixed target-release plan ConfigMap is immutable, excludes the changing phase/execution fields, and is
created before the Job as an install-order mutex. A fixed Lease records ownership. A second temporary release
therefore cannot target the same Formbricks release. The Lease is an ownership marker, not an expiring
heartbeat.

The chart deliberately has no Helm or Argo hook annotations and no permission to scale workloads. Operators
must quiesce the application explicitly and set `activation.workloadQuiesced=true`; this acknowledgment is
required for `activate` and `rollback-begin` renders.

```sh
helm uninstall formbricks-v6-upgrade-1 --namespace formbricks

kubectl get configmap,lease,job --namespace formbricks \
  -l formbricks.com/upgrade-generation=1
```

Uninstalling removes only temporary Kubernetes objects. It cannot undo an in-progress database-backed state;
complete finalization or rollback first.
