# EU rc.5 isolated image rehearsal

Evidence collected on 2026-09-17. **Not production approval.** All writes and deployments in this
rehearsal were confined to `formbricks-eu-rc5-rehearsal`; EU stayed on v5.4.2. Apollo, Artemis and KSA
were unchanged. Production PostgreSQL was queried read-only for migration checksums and aggregate
counts; no customer rows or credentials were copied.

## Frozen artifacts

The bridge is the temporary branch `bhagya/eu-rc5-product-bridge` at source
`c03bbf5c96cd597dc302beee392e36a94c872194`. Later documentation-only commits do not rebuild or replace
these artifacts. [Cloud build 35228904097](https://github.com/formbricks/formbricks/actions/runs/35228904097)
succeeded with production/staging publication disabled.

All images below use ECR repository
`715841356175.dkr.ecr.eu-central-1.amazonaws.com/formbricks/formbricks`.

| Purpose                          | Immutable digest                                                          |
| -------------------------------- | ------------------------------------------------------------------------- |
| Original EU v5.4.2               | `sha256:326357eb8d2a95856dbf9a8c52b937e3bc7214d46ee959fd0e2b5ec997ded437` |
| Temporary bridge                 | `sha256:40afe2054a0c6cc3c1fbb24bd5a6d7b7c9dac2dfba92b61b3acc7052993de15b` |
| Additive-only migration artifact | `sha256:c247f5ad88a3bce84e853a75e5d4be61d20edc21d5bf8f9ebff3df7b30c14abc` |
| Pre-bridge backfill artifact     | `sha256:58ba9fc3e0b8c83f0467527ab459cb6c2f94e6ea641cef2e8819d12780faf12a` |
| Final rc.5                       | `sha256:216b7d5c4e7f2554dd27b216e81150e146774aa8e107a13e26c229bf0659ae8b` |

The unique bridge tag is `6.0.0-bridge-eu.20260917.gc03bbf5c9`; migration tags append `-expansion`
and `-prepare`. No mutable environment tag was updated. Nodes were amd64. Pod image IDs reported the
pinned image digests above; ECR's corresponding amd64 manifest is
`sha256:b6461a5f93f7a020211969533368ce464bc05d907373382b6e23e91fbe4731b4` for the bridge and
`sha256:3919732d67216fbddeb01f2bdf3e2d4d9d5eaab2819eb39ae615981f77cf8c3c` for rc.5.

The two restricted images were inspected before execution: their migration directories matched their
packaged manifests exactly. Expansion contained 197 historical/additive migration directories and no
embedded-data backfill or contractions. Preparation contained 198, adding only that backfill; neither
contained the removed-survey-column or chart-enum contraction. Original migration names and checksums
were retained. The final rc.5 runner was used only after all original v5 pods had terminated.

## Isolated fixture

- Dedicated PostgreSQL 17/pgvector database, Valkey, private SpiceDB and disposable application secrets;
  no ingress. Namespace network policy permits only intra-namespace traffic and DNS. Outbound HTTPS
  and direct-IP TCP probes were blocked with CNI policy enforcement enabled.
- Two synthetic organizations, owner account and existing session, an API key, assigned and foreign
  workspaces, survey responses, a dataset and a legacy line chart. Customer email, billing, webhooks
  and integration delivery were not configured and external egress was blocked.
- 79,269 synthetic surveys with 3,060 legacy embedded-data declarations matched the observed EU survey
  counts. This does **not** reproduce EU tenant distribution, grant counts, response volume, Aurora
  topology, concurrent traffic or authorization graph size.

The namespace uses a 20 GiB temporary PVC and a bounded resource quota. It remains available for further
rehearsal, with an owner/review-after annotation of 2026-09-25. That annotation is not automatic cleanup.

## Executed sequence and results

| Check                            | Result / limitation                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact v5 image on its own schema | Signup, login, existing session, navigation, survey list/read, cross-tenant denial and respondent submission passed                                                                   |
| Expansion beside v5              | Passed; migration container ran about 6 seconds, 51 seconds including scheduling/image pull; v5 API probes remained successful                                                        |
| Embedded-data backfill           | Passed with 3,060 synthetic candidates; container ran about 8 seconds, 14.7 seconds including scheduling                                                                              |
| Bridge, then final contractions  | Rollout and canonical final migrations passed; final Job completed in 10.9 seconds including scheduling                                                                               |
| Graph preparation                | Canonical schema, backfill, outbox drain and two consecutive clean `upgrade check` audits passed                                                                                      |
| Exact rc.5 authority             | Existing session, navigation, survey read/list, API-key access and user/API-key cross-tenant rejection passed                                                                         |
| Post-cutover changes             | Survey creation/edit, owner-to-billing downgrade denial, owner restoration, API-key workspace-grant removal and restoration passed                                                    |
| rc.5 SpiceDB outage              | Protected API returned HTTP 500 in 314 ms, not an ordinary denial; `/health` remained HTTP 200                                                                                        |
| Actual bridge rollback           | Existing sessions/API keys and reading/editing rc.5-created surveys passed without restoring PostgreSQL                                                                               |
| Bridge SpiceDB outage            | Protected API remained HTTP 200 (58 ms); `/health` remained HTTP 200                                                                                                                  |
| Forward recovery                 | Exact rc.5 redeployed; focused session/user/API-key checks and clean upgrade audit passed again                                                                                       |
| Response delivery                | 600 continuous submissions across transitions/outage returned HTTP 200 with zero failed requests; all 607 accepted submissions including individual probes were present in PostgreSQL |
| Data invariants                  | 6,120 embedded-data links retained; legacy chart became `area` with line styling; removed survey column absent; zero dead letters                                                     |

The API key with its final workspace grant removed returned HTTP 401, matching the existing authentication
contract for a key with no usable workspace scope. The first test expected 403; that expectation was corrected
after checking `modules/api/lib/api-key-auth.ts`. Initial fixture-only checks also used an invalid empty-block
survey and an unsupported single-survey query parameter; corrected valid requests passed. Local port-forward
disconnects were eliminated by executing probes inside the current application pod. These were harness issues,
not evidence of a production regression or evidence of browser compatibility.

The rehearsal's only product writer was the controlled test harness. It stopped product mutations while
preparing the bridge. This is **not** validation of the production gateway allowlist or worker/controller pause.
The continuous traffic probe exercised a single public response-create endpoint at roughly one request/second;
it is not an EU capacity test or proof for partial updates, every SDK route, uploads or other respondents' paths.

## Secret-safe evidence and known limits

Ten retained application/infrastructure/Job logs were scanned for generated secrets with zero matches.
Logs from pods deleted during earlier rollouts were not retained in this scan, and the retained logs had no
AuthZed component diagnostic lines. Therefore this is not full authorization-log or all-version log certification.
Raw backfill output still includes an operational resume cursor; do not copy it into shared release evidence.
Use the sanitized `upgrade check` audit summary. Resolve/document that existing CLI contract exception separately.

Source/test changes were validated before the image build: 1,043 earlier focused unit tests, 344 focused tests
after chart compatibility changes, 17 real-PostgreSQL tests, typecheck, changed-file lint, canonical schema
validation, application build and isolated SDK/projection smoke. Those counts overlap; do not add them into a
claimed unique-test total. Pre-contraction chart service compatibility was tested locally with real PostgreSQL;
the image-level service test before contraction was not completed and remains a focused gap.

## Follow-up preflight on 2026-09-17

The approved observation strategy now reuses applicable staging QA/soak evidence for the unchanged rc.5
digest. A new blanket observation window is not required solely because the bridge is new. The focused
bridge/EU deployment checks remain required; this decision does not establish that every earlier staging
result applies to the EU data distribution, traffic or deployment mechanism.

Read-only production checks and requests against the isolated fixture found:

| Check                           | Result                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing respondent tab action  | rc.5's own PIN action returned HTTP 200 with the expected survey result; the exact live v5 PIN action ID returned HTTP 404 with `x-nextjs-action-not-found: 1` against the same fixture. Both artifacts lack a configured deployment ID. This is a failed HTTP compatibility check, not a completed browser reload test. |
| Gateway coverage                | Normal application pages bypass Envoy, and the existing `test.formbricks.com` ingress also points directly to the application service. An Envoy-only pause cannot establish the product-write boundary.                                                                                                                  |
| In-pod background jobs          | The shared `background-jobs` BullMQ queue was not paused. Zero active jobs at inspection time is not a freeze; recurring and newly enqueued work can still start.                                                                                                                                                        |
| Request draining                | The live application deployment had a 30-second termination grace period and no pre-stop hook. The jobs runtime exits after closing workers; this does not independently establish HTTP/Server Action drain completion.                                                                                                  |
| Artifact vulnerability coverage | Inspector reported successful active coverage for the exact bridge and rc.5 amd64 child manifests; the active High/Critical findings query returned no findings for those images. This is scan evidence, not a complete security sign-off.                                                                               |

The reproducible local `check-existing-tab-actions.mjs` probe reads only action metadata from production
and sends requests only to the synthetic rehearsal survey. It requires a successful target-version positive
control, emits no survey/actor/token values, and exits 2 for incompatible previous-version actions. Initial
manual requests used inconsistent Origin/Host headers and were rejected by the CSRF guard; the corrected
same-origin requests produced the results above. Do not count those initial harness errors as an app defect.

Before rollout, provide a tested compatibility/reload strategy for existing respondent tabs and verify it in
a real browser. A required customer reload or interruption of PIN/email respondents is a change to the
uninterrupted-respondent promise, not something to accept silently. Do not leave original v5 pods running
after incompatible migrations to work around old actions.

## Still blocking production promotion

1. Complete and test the production writer inventory and selective pause: gateway paths, workers, jobs,
   imports, integrations, autoscalers and GitOps restart prevention. Measure both pause windows and recovery
   inside the approved time budget. No method-only allowlist or unrestricted migration hook is acceptable.
2. Verify real old/new browser tabs, Server Actions, static assets and graceful draining; remaining respondent
   paths; chart/dashboard image compatibility; anonymization and typed/locked embedded-data behavior across
   rollback; the broader API/MCP/current permission matrix.
3. Map existing staging evidence to EU-shaped authorization/response load with 2× headroom, Aurora lock/pool
   behavior, durable delivery, retained-log safety and backup restoration. Run the missing checks rather than
   repeating unchanged functionality. Keep the artifact scan results above separate from runtime proof.
4. Link applicable existing staging observation evidence to the pinned rc.5 artifact and configuration. Do not
   restart the full soak by default; preserve the approved post-cutover production monitoring requirements.

EU production was last verified healthy on v5.4.2 (4/4 application replicas at the follow-up check), with
three private SpiceDB replicas healthy. No EU application rollout, production migration, schema application,
backfill, queue pause or ingress mutation was performed in this rehearsal or follow-up preflight. The blocker
is the concrete compatibility/pause work above, not a newly imposed week-long wait.
