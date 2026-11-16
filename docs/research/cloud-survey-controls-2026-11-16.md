# Cloud survey feed and reversible blocking: source research

Date: 2026-11-16  
Question: [Establish the Cloud survey feed and reversible blocking options](https://linear.app/formbricks/issue/ENG-7272/research-establish-the-cloud-survey-feed-and-reversible-blocking)  
Map: [Find a near-term Cloud solution for automatic survey abuse blocking](https://linear.app/formbricks/issue/ENG-7271/find-a-near-term-cloud-solution-for-automatic-survey-abuse-blocking)

## Scope and evidence boundary

The accepted destination is automatic, reversible blocking of individual surveys on app.formbricks.com after publication and relevant edits, preserving survey/response data and leaving organization/account action to humans. Brief post-publication exposure is acceptable; avoiding an application release is a preference. Staging is for validation. This investigation made no live customer-content reads, production access probes, infrastructure changes or moderation actions. It does not select the architecture or classifier policy.

Sources inspected:

| Source                                             | Pinned revision                            | Meaning                                                               |
| -------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Application checkout                               | `fa0546bda2`                               | The worktree base; source facts only                                  |
| Application chart source named by GitOps           | `8a81f03a79e5cca1a16bf4b75f665185654892a2` | Desired 6.2.0 release source, inspected where behavior differs        |
| GitOps origin/main fetched during research         | `4ac8c79305469edb529dc6c87273afce0cfafc9f` | Desired deployment/routing configuration, not proof of reconciliation |
| Infrastructure origin/main fetched during research | `02c5f68a3826c507946ca0815fd5b99d59191ca8` | Desired infrastructure/access configuration, not proof of apply       |

GitOps names application 6.2.0 with a digest and a pinned chart commit; its production Application requires manual sync. Neither that pin nor merged source establishes the running image, database schema, gateway configuration or permissions. The checkout differs materially from this desired release: the release has survey-list `view=full` with a 50-item cap, whereas the checkout's list is summary-only. Both require a workspace and lack an updated-since filter. [G1][G4][A1][A2]

## Findings

### A survey feed is not currently an existing cross-workspace integration

1. Customer webhooks only support response creation, update and finish; no survey-created, published or edited trigger exists in the inspected schema. MCP survey list/get tools use `surveys:read` and ordinary workspace/survey authorization. They are not an all-Cloud operator API. Creation can occur before meaningful content exists, and publication also happens in a scheduler, so neither a creation notification nor the editor's PostHog publish event is a complete feed. [A3][A4][A5][A6]
2. Storage has survey identifiers, workspace/creator/owner, `createdAt`, `updatedAt`, status, legacy `questions`, `blocks`, welcome/endings, redirects and schedule fields. The desired release's schema indexes `[workspaceId, updatedAt]`, not global `updatedAt`. Full v3 serialization rejects legacy question-based surveys. A scanner must normalize the actual deployed schema and both content shapes rather than assume v3 full view can read every row. [A7][A8]
3. Existing Hazel incident access is deliberately unsuitable: its Terraform policy explicitly denies database contents, secret values and other data access; its runbook says no Kubernetes access. Do not broaden that diagnostic role implicitly or reuse application database credentials. The production database has a private-network boundary in source. No dedicated survey-feed identity or moderation writer was found in the inspected owning sources. This is a bounded source search, not a live permission test. [I1][I2][I5]
4. A narrow projection view or a small broker reading such a projection is a technically feasible new feed without changing the application image. PostgreSQL views can expose selected data under carefully chosen ownership/grants; the existing auditor runbook's `SELECT ON ALL TABLES` example would exceed this scanner's need. Network access, ownership, grants, retention and deployment remain work. A read-only database account alone does not minimize the columns or tenant data it can read. [I2][I3][P1]

**Proposed feed requirements, derived from these facts:** enumerate workspaces and perform bounded per-workspace reads using the existing index, or add a reviewed global index/change outbox. Select only classifier content and identifiers; exclude respondent answers, contact data, PINs, access tokens, internal follow-up recipients and unrelated settings. Include all enabled language variants, user-visible headings/descriptions/options, relevant URLs and media references; explicitly decide image/OCR and embedded-data treatment rather than silently omit them. Store a content fingerprint and extraction/model/policy versions so `updatedAt` changes unrelated to content need not trigger repeat model calls. This is a design candidate, not an implemented feed. [A7][A8]

For polling, a proposed `(updatedAt, id)` cursor needs bounded pages, byte/time budgets, durable progress only after work is durably queued, at-least-once retry and deduplication by survey/content/model/policy version. Use a cutoff, overlap and periodic reconciliation rather than treating a timestamp as a commit-ordered log: a long-running transaction can commit an older timestamp after a poll passed it. A fixed overlap does not prove losslessness for arbitrarily long transactions. If the eventual exposure bound requires lossless changes, a transactional outbox/change stream or a proven bounded reconciliation interval is a separate decision. A deleted/paused row is an explicit outcome, not a reason to skip recovery. PostgreSQL's transaction visibility rules support this concern; `@updatedAt` is a mutation timestamp, not a durable event sequence. [A7][P2]

### Pause and archive are lifecycle controls, not persistent moderation restrictions

Public link rendering shows an inactive screen when paused/completed, and the public v1/v2 response endpoints check `inProgress`. Finalizing an already-created partial response also checks status. New public upload URLs require active and unarchived status. Thus pausing changes server intake as well as the UI. [A9][A10][A11][A19][A20]

However:

- A normal authorized survey patch writes customer-requested status. Optional compare-and-set protects a specific write from stale data; it does not prevent a later authorized reopen. A patch without the precondition can restore the status from an earlier read after an external pause. [A12]
- A paused survey with a due `publishOn` can be published by the background scheduler. Ordinary status normalization does not universally clear that field on pause. [A6]
- Archive pauses active surveys and sets `archivedAt`, but preserves the schedule. It can be restored under the same ordinary read/write authorization, and it enters a retention/purge lifecycle. It cannot stand in for a data-preserving moderation hold. [A13][A14]
- Authorized management response creation is a separate path: v3 loads no survey status/archived field for its write, then authorizes and persists the response; MCP `create_response` delegates to it. A pause therefore does not establish a universal prohibition on collection. Existing v1/v2 management writes also need inclusion in implementation coverage, not a presumption that public API gates protect them. [A15][A24][A29]
- Public request handlers read status before later persistence. A request that passed the read can race a block; a one-time read is not an atomic block-versus-submit guarantee. [A10]

A restriction must therefore have a durable identity distinct from customer lifecycle status and an authorized release operation. Its existence must survive edits, re-publication, scheduling and restoration. Whether previously approved edited content automatically releases a restriction is a policy decision, not implied by a new scan.

### Enforcement coverage follows survey identity, not one URL pattern

| Surface                                                          | Verified shape / implication for a new control                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/s/<surveyId>` and its metadata                                 | Survey identity is in the path. Existing public loader checks link type, draft and archive; renderer checks active status. A survey-specific external deny can identify this path. [A9][A25]                                                                                                                                      |
| `/c/<jwt>`                                                       | The server verifies a contact token and extracts `surveyId`/contact identity before loading the survey. A list of `/s/<id>` paths misses this alias. An external service needs a trustworthy token-to-survey resolver or validated token handling; arbitrary unverified token payloads must not become authorization facts. [A16] |
| `/p/<slug>`                                                      | Present in source but explicitly 404s when `IS_FORMBRICKS_CLOUD` is true. Verify the deployed Cloud gate; do not design a separate Cloud slug path without evidence. [A17]                                                                                                                                                        |
| App/SDK survey delivery                                          | One workspace-state response contains multiple active surveys. State-level authorization cannot omit just one survey from a cached mixed response. Correct selective suppression needs origin filtering, response transformation, or a compatible status control plus intake enforcement. [A18][A23]                              |
| Public v1/v2 response POST                                       | Survey ID is in JSON, not the URL. An external enforcer needs bounded body parsing and workspace/legacy-ID resolution; path matching alone cannot distinguish surveys sharing a workspace. [A10]                                                                                                                                  |
| Public response PUT                                              | Path identifies a response. v2 re-exports v1. A resolver must bind response ID to stored survey/workspace before checking the restriction. [A19][A26]                                                                                                                                                                             |
| Display creation, upload authorization and public survey actions | Include both client API versions, PIN/email verification/single-use actions and metadata paths in validation. Upload and display gates differ; do not infer one route from another. Existing public-access helpers centralize the link action conditions. [A9][A11][A27]                                                          |
| Management v1/v2/v3 and MCP writes                               | Authenticated callers can write responses and modify survey lifecycle. A restriction must remain effective despite these writes. Denying only browser pages leaves these paths outside the control. [A12][A15]                                                                                                                    |
| Previously delivered content/assets                              | An origin block cannot erase an open page, browser cache, already-downloaded asset or already-issued capability. Define the promise as no new serving/intake after an acknowledged bound; measure stale-cache and in-flight behavior separately. [A18]                                                                            |

The source SDK state has a one-hour expiry and checks expiry every minute. Its origin data cache is 60 seconds and HTTP headers allow stale serving. Pausing cannot be represented as immediate removal of already-rendered SDK content. Public intake checks current state independently, but the read/write race remains. [A18][A21][A22]

### Existing infrastructure offers insertion points, not a finished control

Desired DNS proxies app.formbricks.com through Cloudflare; desired ALB ingress forwards the app catch-all to Envoy, whose HTTPRoute forwards to the application. Infrastructure also defines an app-host origin WAF to reject direct-origin connections outside Cloudflare. These are plausible external-enforcement insertion points only if current reconciliation, host aliases and direct-origin behavior are verified later. An edge control is bypassable if any route reaches origin without it. [I4][I6][G2][G3]

Envoy Gateway 1.8 documents external HTTP/gRPC authorization attached through SecurityPolicy, including request-body buffering and explicit fail-open/error choices. Buffer limits can reject a request before authorization, so a new body-aware policy can change legitimate upload/API behavior if applied too broadly. Existing desired gateway rate-limit failure behavior is not a moderation decision. Match the actual installed controller/CRD version before using these fields. [E1][E2][G2]

If Cloudflare Workers KV is considered for a deny ledger, its documented eventual consistency includes cached misses and visibility delays of 60 seconds or more. Do not promise an instantaneous global block or unblock acknowledgement from a KV write alone. A different store or an explicit propagation allowance would be required by a tighter agreed bound. This investigation does not establish Cloudflare product entitlement, API permissions or an installed Worker. [C1]

## Feasible paths and limits

These are technical candidates, not an architecture selection.

| Candidate                                                           | No new application image?                                             | Can satisfy persistent individual-survey blocking?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Poller + ordinary pause/close                                       | Yes, assuming scoped feed/write access is provisioned                 | **No by itself.** Customer reopen, scheduled publication, optional stale writes and management intake remain. Useful mechanism, incomplete boundary.                                                                                                                                                                                                                                                                                                                                                                                    |
| Poller + external persistent deny ledger + body-aware gateway/proxy | Yes in principle; new service and infrastructure rollout required     | **Conditional.** `/s`, `/c`, response JSON and response-ID paths are resolvable with explicit adapters. Must also cover aliases/origin bypass, mixed SDK state, opaque application actions and internal/API/MCP writes. A path-only WAF list is insufficient; request authorization alone cannot selectively rewrite an SDK response. No complete implementation or deployment is present/proven.                                                                                                                                       |
| Poller + persistent DB restriction ledger and database guards       | Yes in principle, but new database/infrastructure deployment required | **Conditional.** PostgreSQL triggers can modify/refuse survey and response writes independently of callers. A guard could preserve a hold through reopen/scheduler writes and reject response insert/update. It still needs serialization with restriction changes, serving/cache integration, separate rights and release controls. Undocumented coercion/errors, trigger ordering, migration compatibility and old workers make this a substantive database change, not a safe ad-hoc SQL patch. No such guard was found/proven. [P3] |
| External scanner + a small application moderation boundary          | No; requires an application release, possibly migration               | **Feasible design direction.** Store/read an independent restriction; add one shared serving/intake guard with all adapters using it; deny customer release/bypass; provide constrained operator feed/block/release operations. Classifier and job runner can remain external. Exact files/contracts depend on the chosen deployed base.                                                                                                                                                                                                |

**Factual feasibility answer:** avoiding an application release is technically possible, but not by merely adding a cron, Hazel access and a pause call. A durable no-release route requires a new application-aware proxy and/or database enforcement layer with route/body/identity resolution and race handling. The current sources do not establish an existing complete path. A small app boundary avoids reproducing some of those semantics at the edge, but its scope and trade-off are for the architecture decision. Database-side enforcement without an image change is still a production software rollout. PostgreSQL trigger capabilities establish possibility, not correctness of a proposed trigger design. [A9][A12][A15][A16][A18][P3]

### Version and concurrency invariants for either route

These are requirements to assess, not selected behavior:

1. Bind each classifier result to deployment, survey ID, content fingerprint, extraction version and detector/policy version. Re-read before applying a new restriction; if relevant content changed, requeue rather than silently apply an old verdict to a different survey version.
2. Apply restriction state with an expected revision/content version and audit record; do not overwrite an independent human release or newer verdict. Normal survey `updatedAt` also changes for lifecycle/internal work, so avoid an endless scan → pause → rescan loop.
3. Use separate restriction revision for release. A new customer edit or re-publish must not itself clear a hold. A false positive release and subsequent identical scan must have explicitly defined re-block semantics.
4. Define the effective acknowledgement across ledger commit, enforcement propagation, cache expiry and already-started writes. A transaction that only reads a ledger does not necessarily serialize with a concurrent block under Read Committed. A DB guard needs a proven shared-lock/ordering protocol; a proxy cannot retract a request already forwarded. [P2]
5. Separate scanner failure from known-denied enforcement. Choose timeouts, stale-deny behavior, retry/dead-letter/reconciliation, and rollback/release behavior without letting a classifier outage accidentally block every tenant or silently erase existing holds.

## Follow-up evidence gates

Before implementation is declared ready:

- Verify actual image/chart/DB schema, route/host inventory, origin WAF association and direct-origin rejection, installed Envoy controller/CRDs, cache layers and Cloud mode on staging and production through a separately authorized process. GitOps desired state remains insufficient evidence.
- Select feed identity/hosting/network route and enforce a precise projection. Provisioning, access probes, sample volume and query-plan measurement are outstanding. The existing Hazel diagnostic role supplies none of this by default.
- Measure publication/edit volume and content byte distributions; assess per-workspace polling cost versus global index/outbox. Define recovery and maximum lag against the agreed exposure budget.
- Decide the scope of app/SDK surveys, authenticated management writes, images/media and multilingual content explicitly; select a durable restriction/release authority and its user-facing behavior.
- Validate synthetic staging fixtures through `/s`, signed `/c`, Cloud-disabled `/p`, metadata, cached SDK state, v1/v2 public POST/PUT/display/upload, v1/v2/v3 management and MCP; test schedule/reopen/restore/edits, queued retries, stale verdicts, block-versus-write races, false-positive release, outages and origin bypass. Test coverage must distinguish content still visible from data still accepted.
- Specify reviewer ownership, appeal/release, audit/minimized evidence retention, and detector quality thresholds in their separate decision tickets. No production evaluation data was collected here.

## Primary sources

[A1]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v3/surveys/parse-v3-surveys-list-query.ts#L23-L93
[A2]: https://github.com/formbricks/formbricks/blob/8a81f03a79e5cca1a16bf4b75f665185654892a2/apps/web/app/api/v3/surveys/parse-v3-surveys-list-query.ts#L23-L105
[A3]: https://github.com/formbricks/formbricks/blob/fa0546bda2/packages/database/schema/main.prisma#L90-L127
[A4]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/modules/mcp/tools/surveys.ts#L104-L162
[A5]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/modules/survey/editor/actions.ts#L248-L315
[A6]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/modules/survey/scheduling/lib/survey-scheduling.ts#L155-L318
[A7]: https://github.com/formbricks/formbricks/blob/8a81f03a79e5cca1a16bf4b75f665185654892a2/packages/database/schema/main.prisma#L470-L601
[A8]: https://github.com/formbricks/formbricks/blob/8a81f03a79e5cca1a16bf4b75f665185654892a2/apps/web/app/api/v3/surveys/serializers.ts#L258-L316
[A9]: https://github.com/formbricks/formbricks/blob/8a81f03a79e5cca1a16bf4b75f665185654892a2/apps/web/modules/survey/link/lib/public-access.ts#L16-L35
[A10]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v1/client/%5BworkspaceId%5D/responses/route.ts#L140-L165
[A11]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v1/client/%5BworkspaceId%5D/storage/route.ts#L103-L118
[A12]: https://github.com/formbricks/formbricks/blob/8a81f03a79e5cca1a16bf4b75f665185654892a2/apps/web/app/api/v3/surveys/patch.ts#L456-L474
[A13]: https://github.com/formbricks/formbricks/blob/8a81f03a79e5cca1a16bf4b75f665185654892a2/apps/web/modules/survey/lib/surveys.ts#L176-L274
[A14]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v3/surveys/lib/operations.ts#L692-L755
[A15]: https://github.com/formbricks/formbricks/blob/8a81f03a79e5cca1a16bf4b75f665185654892a2/apps/web/app/api/v3/responses/lib/operations.ts#L923-L985
[A16]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/modules/survey/link/contact-survey/page.tsx#L44-L86
[A17]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/p/%5Bslug%5D/page.tsx#L11-L34
[A18]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v1/client/%5BworkspaceId%5D/environment/route.ts#L75-L94
[G1]: https://github.com/formbricks/gitops/blob/4ac8c79305469edb529dc6c87273afce0cfafc9f/apps/formbricks-prod.yaml#L13-L60
[G2]: https://github.com/formbricks/gitops/blob/4ac8c79305469edb529dc6c87273afce0cfafc9f/formbricks/values-prod.yaml#L610-L762
[I1]: https://github.com/formbricks/infra/blob/02c5f68a3826c507946ca0815fd5b99d59191ca8/bootstrap/aws-oidc/hazel-incident-investigator.tf#L195-L243
[I2]: https://github.com/formbricks/infra/blob/02c5f68a3826c507946ca0815fd5b99d59191ca8/platform/core-data/formbricks-prod-database.tf#L85-L137
[I3]: https://github.com/formbricks/infra/blob/02c5f68a3826c507946ca0815fd5b99d59191ca8/docs/DATABASE-ADMINISTRATION.md#L276-L289
[I4]: https://github.com/formbricks/infra/blob/02c5f68a3826c507946ca0815fd5b99d59191ca8/platform/core-eks/app-origin.tf#L1-L20
[P1]: https://www.postgresql.org/docs/17/sql-createview.html
[P2]: https://www.postgresql.org/docs/17/transaction-iso.html
[P3]: https://www.postgresql.org/docs/17/sql-createtrigger.html
[E1]: https://gateway.envoyproxy.io/v1.8/tasks/security/ext-auth/
[E2]: https://gateway.envoyproxy.io/v1.8/api/extension_types/#extauth
[C1]: https://developers.cloudflare.com/kv/concepts/how-kv-works/
[A19]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v1/client/%5BworkspaceId%5D/responses/%5BresponseId%5D/lib/put-response-handler.ts#L87-L111
[A20]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v2/client/%5BworkspaceId%5D/responses/lib/utils.ts#L11-L34
[A21]: https://github.com/formbricks/formbricks/blob/fa0546bda2/packages/js-core/src/lib/workspace/state.ts#L74-L107
[A22]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v1/client/%5BworkspaceId%5D/environment/lib/environmentState.ts#L146-L172
[A23]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v1/client/%5BworkspaceId%5D/environment/lib/data.ts#L225-L239
[A24]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/modules/mcp/tools/responses.ts#L250-L284
[A25]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/modules/survey/link/components/survey-renderer.tsx#L108-L119
[A26]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v2/client/%5BworkspaceId%5D/responses/%5BresponseId%5D/route.ts#L1-L3
[A27]: https://github.com/formbricks/formbricks/blob/fa0546bda2/apps/web/app/api/v1/client/%5BworkspaceId%5D/displays/lib/display.ts#L39-L55
[A29]: https://github.com/formbricks/formbricks/blob/8a81f03a79e5cca1a16bf4b75f665185654892a2/apps/web/app/api/v3/responses/lib/service.ts#L369-L379
[I5]: https://github.com/formbricks/infra/blob/02c5f68a3826c507946ca0815fd5b99d59191ca8/docs/HAZEL-INCIDENT-ACCESS.md#L40-L61
[I6]: https://github.com/formbricks/infra/blob/02c5f68a3826c507946ca0815fd5b99d59191ca8/modules/domains/formbricks.tf#L485-L494
[G3]: https://github.com/formbricks/gitops/blob/4ac8c79305469edb529dc6c87273afce0cfafc9f/formbricks/prod/web-route.yaml#L1-L25
[G4]: https://github.com/formbricks/gitops/blob/4ac8c79305469edb529dc6c87273afce0cfafc9f/formbricks/values-prod.yaml#L125-L129
