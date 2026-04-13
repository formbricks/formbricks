# Architecture Evaluation: Replacing MinIO in Formbricks

---

### 1. Executive Summary & Context

**The decision Formbricks needs to make:** what should replace MinIO in local development, CI, one-click installs, and the Docker-based self-hosting path we recommend to customers who do not use a hosted S3 provider.

**Why this is now urgent:** as of **April 13, 2026**, the official [`minio/minio` README](https://github.com/minio/minio/blob/master/README.md) starts with: "THIS REPOSITORY IS NO LONGER MAINTAINED." The same README points users to **AIStor Free** and **AIStor Enterprise** as the official successors. It also says the MinIO community edition is now **source-only**, with no maintained precompiled binary releases.

**The Formbricks-specific reality:** Formbricks is already largely S3-generic. The storage runtime in [`packages/storage/src/client.ts`](../packages/storage/src/client.ts) builds a normal AWS SDK S3 client from `S3_*` environment variables, and [`packages/storage/src/service.ts`](../packages/storage/src/service.ts) uses generic S3 operations such as:

- `createPresignedPost`
- `HeadObject`
- `GetObject`
- `DeleteObject`
- `DeleteObjects`
- `ListObjectsV2`

The MinIO coupling is mostly in infrastructure and docs today:

- [`docker-compose.dev.yml`](../docker-compose.dev.yml)
- [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml)
- [`docker/formbricks.sh`](../docker/formbricks.sh)
- [`docker/migrate-to-v4.sh`](../docker/migrate-to-v4.sh)
- `docs/self-hosting/...`

That means this is **not** primarily an application rewrite. It is a decision about the best bundled self-hosted S3-compatible backend to ship and recommend.

**Recommendation:** use **Garage** as the default bundled replacement for MinIO in Formbricks' dev setup, Docker compose examples, and self-hosted guidance. Keep **AIStor Free** documented as an optional manual alternative for operators who specifically want the closest MinIO lineage. Do **not** make SeaweedFS, Ceph RGW, or RustFS the default today.

**Validation status:** this memo is based on official documentation, official repositories, and Formbricks repo inspection. Live side-by-side Docker tryouts are still pending. On **April 13, 2026**, local validation was blocked because `docker ps` failed with `failed to connect to the docker API ... no such file or directory`, so the Docker daemon was not running.

Hosted S3 providers remain valid and out of scope for this decision. If a customer already uses AWS S3, Cloudflare R2, Backblaze B2 S3, or another hosted S3-compatible service, Formbricks should keep supporting that path.

---

### 2. Evaluation Criteria

Before comparing products, the real requirement should be stated plainly: Formbricks does **not** need "a MinIO replacement" in the abstract. It needs a self-hosted object store that cleanly supports the exact S3 flows Formbricks already uses.

The criteria for this evaluation are:

1. **S3 compatibility with Formbricks' actual upload flow**
   - Browser uploads through presigned POST
   - Object reads, deletes, multi-delete, and listing
   - Path-style addressing when needed

2. **Bucket-level operational fit**
   - Bucket bootstrap
   - Access key provisioning
   - Bucket CORS support for browser uploads

3. **Local and CI ergonomics**
   - Single-node setup
   - Reasonable Docker / Docker Compose flow
   - Low-friction startup in dev and e2e

4. **Self-hosted customer ergonomics**
   - Reasonable one-click install story
   - Clear docs
   - Low operator burden for customers who just want Formbricks to work

5. **Future-proofing**
   - Clear maintenance story
   - Clear license story
   - A credible path beyond single-node setups

6. **Bundled-default suitability**
   - It is not enough to be technically capable
   - The default choice should be the one that creates the least confusion, license friction, and operational overhead for the broadest set of self-hosters

---

### 3. Core Alternatives

#### Option A: AIStor Free

**What it is and how it works**

AIStor Free is the official successor path MinIO now points community users toward. MinIO's official docs describe AIStor Object Store as a "drop-in replacement" for the AGPLv3 MinIO community server, and the docs position AIStor as the current S3-compatible object store in the MinIO ecosystem.

**What it excels at**

- It is the closest thing to a direct MinIO successor.
- It should be the lowest-risk path for teams that want MinIO-like semantics, tooling, and admin UX.
- It preserves the familiar MinIO mental model better than any other option in this memo.

**How well it matches Formbricks specifically**

From a pure S3-compatibility perspective, AIStor Free is a very strong fit. If Formbricks only cared about minimizing behavior differences from the old MinIO setup, AIStor Free would be the most conservative choice.

**Operational and licensing trade-offs**

This is where the default-fit story weakens. The official MinIO AIStor docs describe AIStor as licensed under the **MinIO Commercial License**, not a normal community open-source license. The AIStor docs and CLI docs also center license management and SUBNET registration workflows. That does not make AIStor unusable, but it does make it a much worse default for an open-source self-hosted compose path than MinIO used to be.

**Why it should or should not be the bundled default**

AIStor Free is a credible option to document, but it is **not** the right bundled default for Formbricks. The issue is not compatibility; it is license clarity, onboarding friction, and the fact that Formbricks would be recommending a commercially framed successor as the default path for open-source self-hosting.

**Conclusion**

Document as an **optional manual alternative**, not as the default.

#### Option B: AIStor Enterprise

**What it is and how it works**

AIStor Enterprise is the commercial distributed edition in the MinIO ecosystem, explicitly sold with commercial support.

**What it excels at**

- Vendor-backed support
- Enterprise procurement story
- Strong continuity for teams already committed to MinIO operations

**How well it matches Formbricks specifically**

Technically, it would work. Practically, it is not what Formbricks should bundle or recommend by default for the general self-hosted audience.

**Operational and licensing trade-offs**

This is the most commercial option in the comparison. That may be appropriate for larger enterprises, but it conflicts with the goal of a low-friction, broadly usable default that customers can run from a straightforward compose setup.

**Why it should or should not be the bundled default**

It should **not** be the bundled default. It is a valid enterprise customer choice, not a sensible baseline for Formbricks' self-hosted defaults.

**Conclusion**

Keep out of the bundled path. Mention only as an enterprise-specific alternative if needed.

#### Option C: Garage

**What it is and how it works**

Garage describes itself as an **S3-compatible distributed object storage service designed for self-hosting at a small-to-medium scale**. The project says it is lightweight, easy to operate, and designed for resilient self-hosting. The Garage team also says they have used it in production since its first release in 2020.

**What it excels at**

- Open-source and self-hosting-first positioning
- A small-to-medium scale target that matches Formbricks much better than hyperscale-focused systems
- Clear official quick-start for node layout, key creation, bucket creation, and access grants
- Official S3 compatibility documentation aimed at implementers

**How well it matches Formbricks specifically**

This is the strongest overall fit. Garage's official docs explicitly cover the compatibility surface Formbricks cares about, including presigned URL behavior, path-style access, and browser-upload relevant features such as `PostObject` and bucket CORS. Formbricks does not need an embedded admin suite as much as it needs a reliable S3-compatible backend with a clean self-hosting story, and that is exactly where Garage is strongest.

**Operational and licensing trade-offs**

Garage is not as turnkey as old MinIO in the sense of "run container, open console, click bucket." The official quick start still involves explicit bootstrap steps such as assigning layout, creating keys, creating buckets, and granting permissions. That said, those steps are scriptable, deterministic, and compatible with how Formbricks already provisions dev and CI resources.

Garage is also licensed under **AGPLv3**, which is clear, familiar, and aligned with an open-source distribution story.

**Why it should or should not be the bundled default**

It **should** be the bundled default. It gives Formbricks a future-proof self-hosted story without introducing commercial licensing confusion. It also keeps the implementation scope modest because Formbricks can preserve its existing `S3_*` env contract and replace MinIO mainly at the infra/docs layer.

**Conclusion**

Best bundled-default choice.

#### Option D: SeaweedFS

**What it is and how it works**

SeaweedFS is a broader distributed storage platform with a blob store, filer layer, and S3 API. Its official README highlights a quick single-binary path (`weed mini`) and a quick S3 Docker path, and it is licensed under **Apache 2.0**.

**What it excels at**

- Very strong dev ergonomics for local experimentation
- Broad storage platform capabilities beyond just object storage
- A simple single-node story for development
- Active open-source project with a large feature surface

**How well it matches Formbricks specifically**

SeaweedFS is clearly capable enough to be a real option. The official repo includes S3 POST policy handlers and bucket CORS handlers, which is strong source-level evidence for Formbricks' upload use case. But SeaweedFS is also not really "just an S3-compatible object store." It is a larger storage platform with more architecture surface area than Formbricks needs for a default bundled backend.

There is another important signal in SeaweedFS' own README: in its comparison to MinIO, it says MinIO has stronger S3 API fidelity, UI, policies, and versioning, and that SeaweedFS is "trying to catch up here." That does not disqualify SeaweedFS, but it matters when the decision is about a low-risk default.

**Operational and licensing trade-offs**

SeaweedFS is attractive technically and operationally lighter than Ceph, but broader and more opinionated than Garage for this problem. Formbricks would be asking self-hosters to adopt a multi-surface storage platform when the product only needs dependable S3 compatibility.

**Why it should or should not be the bundled default**

It should **not** be the default today. It is a credible alternative for operators who specifically want SeaweedFS, but it is not the narrowest or clearest answer to the Formbricks problem.

**Conclusion**

Credible, but not the best default.

#### Option E: Ceph RGW

**What it is and how it works**

Ceph Object Gateway (RGW) is Ceph's object storage interface. The official Ceph docs describe it as an HTTP gateway that exposes a large subset of the Amazon S3 API on top of a Ceph storage cluster.

**What it excels at**

- Production credibility at very large scale
- Strong long-term maintenance confidence
- Natural fit for organizations already running Ceph

**How well it matches Formbricks specifically**

From a pure capability standpoint, Ceph RGW can absolutely satisfy Formbricks' S3 requirements. The problem is not capability. The problem is that Ceph is a much larger operational system than Formbricks should ask a typical self-hoster to adopt just to enable file uploads.

**Operational and licensing trade-offs**

The operational burden is the key drawback. Ceph's own docs frame RGW as a service within a broader Ceph deployment model, with service specs and multi-site concepts such as realms, zonegroups, and zones. That is reasonable for storage teams; it is not reasonable as a default dependency for Formbricks' bundled compose setup.

This is an inference from Ceph's documented deployment model, not a claim that Ceph is bad. Ceph is excellent at what it is built for. It is simply the wrong default level of complexity here.

**Why it should or should not be the bundled default**

It should **not** be the default. Customers already invested in Ceph can keep using it as an external S3-compatible backend, but Formbricks should not bundle it.

**Conclusion**

Technically strong, operationally too heavy for the default path.

#### Option F: RustFS

**What it is and how it works**

RustFS is a newer Rust-based object storage project that positions itself as S3-compatible, open-source, and easy to deploy. Its README advertises Docker quick-start, a web console, single-node mode, and Apache 2.0 licensing.

**What it excels at**

- Very appealing developer and operator ergonomics on paper
- Clear Docker quick-start
- Built-in console
- Strong compatibility claims
- Permissive license

**How well it matches Formbricks specifically**

RustFS is the most interesting "watch this space" option in the list. Its README claims full S3 compatibility, and its own implemented test list explicitly includes:

- `POST Object`
- `ListObjectsV2`
- bucket policy operations
- presigned URL coverage
- bucket-level CORS configuration and preflight behavior

That is exactly the sort of feature evidence Formbricks needs.

**Operational and licensing trade-offs**

The main concern is maturity, not ergonomics. RustFS' own README still marks **distributed mode** as "Under Testing." For Formbricks, that makes it hard to call the project the most future-proof default yet, even if the single-node experience looks attractive.

**Why it should or should not be the bundled default**

It should **not** be the default today. The project looks promising, and the compatibility posture is impressive, but it is still too early to make it the official bundled answer for Formbricks.

**Conclusion**

Very promising, but still too early for the default. Revisit later.

---

### 4. Adjacent / Secondary Alternatives

These are worth acknowledging because they came up during the scan, but they are not the strongest primary candidates for Formbricks.

#### Scality CloudServer / Zenko

CloudServer's official README describes it as an open-source S3-compatible server that is useful for developers, especially for CI and local AWS S3 emulation. That wording is important: it is a strong signal that CloudServer is excellent as a dev/test abstraction layer, but not the most compelling answer for Formbricks' bundled self-hosting default.

The README also still references older Node.js and Yarn requirements, which reinforces the sense that this is not the path to standardize on for a simple modern bundled backend.

**Conclusion:** useful for emulation and testing; not recommended as the default bundled storage backend.

#### OpenIO SDS

OpenIO's official README describes it as object storage for **very large-scale unstructured data volumes**. That is a valid storage target, but it is not the problem Formbricks is solving. The project appears more oriented toward large-scale storage deployments than low-friction product bundling.

**Conclusion:** credible storage software, but not a strong match for Formbricks' default self-hosted path.

#### CORTX Community

This one is straightforward. The official README says:

- "This project is not maintained anymore"
- "CORTX Community is not intended for production usage"

That removes it from serious consideration immediately.

**Conclusion:** not recommended.

#### MinIO-adjacent console and fork efforts: OpenMaxIO / "opens3"

The most visible concrete community effort I could validate was **OpenMaxIO**, whose README says it is a **fork of MinIO Console** and shows how to connect the UI to an existing MinIO server using `CONSOLE_MINIO_SERVER=...`.

That is interesting, but it is not enough for Formbricks' decision. A console fork is not the same thing as a mature, documented, production-grade object storage server replacement. I did **not** find a clearly documented, widely credible, maintained full server replacement in this category that looked stronger than Garage, SeaweedFS, or RustFS.

**Conclusion:** community frustration with MinIO is real, but these efforts are not strong enough to anchor the Formbricks default.

---

### 5. Requirements Assessment Table

Legend:

- **Strong** = strong fit for Formbricks on this criterion
- **Good** = likely workable, but with caveats
- **Mixed** = viable but meaningfully compromised for this use case
- **Poor** = should not be the default on this criterion

| Requirement | AIStor Free | AIStor Enterprise | Garage | SeaweedFS | Ceph RGW | RustFS |
| --- | --- | --- | --- | --- | --- | --- |
| Presigned POST / browser upload fit | Strong | Strong | Strong | Good | Good | Strong |
| Bucket CORS support | Strong | Strong | Strong | Good | Good | Strong |
| Single-node local/dev friendliness | Mixed | Poor | Good | Strong | Poor | Strong |
| Docker Compose friendliness | Mixed | Poor | Good | Good | Poor | Good |
| Admin UX / console | Strong | Strong | Mixed | Mixed | Good | Strong |
| Open-source and license clarity | Mixed | Poor | Strong | Strong | Strong | Strong |
| Operational burden for self-hosters | Mixed | Poor | Good | Mixed | Poor | Good |
| Confidence in long-term maintenance | Good | Strong | Good | Good | Strong | Mixed |
| Fit as Formbricks bundled default | Mixed | Poor | **Strong** | Mixed | Poor | Mixed |

**Why Garage wins this table**

Garage is not first in every single row. AIStor is closer to old MinIO behavior, SeaweedFS is arguably easier to spin up casually, Ceph is stronger for large storage organizations, and RustFS has a more polished console story. But **Garage is the best overall balance** across:

- S3 capability relevant to Formbricks
- clear open-source licensing
- self-hosting-first design
- scriptable single-node bootstrap
- a credible multi-node future path
- low enough operational burden to bundle confidently

That is exactly what a default should optimize for.

---

### 6. Final Recommendation

**Recommendation:** replace MinIO with **Garage** in Formbricks' dev setup, CI bootstrap, one-click install flow, and recommended Docker-based self-hosted setup for users without a hosted object store.

#### Why Garage is the right default

1. **It matches what Formbricks actually needs**

Formbricks needs an S3-compatible backend for presigned POST uploads and basic object CRUD/list behavior. Garage's documented compatibility surface and self-hosting posture line up with that requirement cleanly.

2. **It keeps the implementation scope small**

The Formbricks runtime can stay S3-generic. The main work is replacing MinIO in the surrounding infrastructure and docs rather than redesigning storage code.

3. **It is future-proof in the right way**

Garage is neither abandonware nor a commercially gated successor. It has a clear open-source license, a self-hosting-first identity, and a real multi-node story if Formbricks ever wants to support larger operator footprints.

4. **It avoids avoidable licensing confusion**

AIStor is the most direct MinIO successor, but it is not the best open-source default to place in Formbricks' public self-hosted story.

#### What to do with the other credible options

- **AIStor Free:** document as an optional manual alternative for teams that want the closest MinIO lineage or a richer MinIO-style admin experience and accept the MinIO commercial licensing model.
- **SeaweedFS:** recognize as a credible open-source alternative, but do not standardize on it because it is a broader storage platform and its own README signals some S3 feature catch-up versus MinIO.
- **Ceph RGW:** support as an external S3-compatible backend for customers who already run Ceph; do not bundle it.
- **RustFS:** keep on the watchlist. It looks promising, especially for S3 compatibility and operator ergonomics, but it is still too early to call it the safest default.

#### What not to recommend

- Scality CloudServer / Zenko as the default backend
- OpenIO SDS as the default backend
- CORTX Community
- console-only or loosely defined MinIO-adjacent fork efforts as the default path

#### Practical implication for implementation

If Formbricks adopts Garage, the expected implementation scope is:

- replace MinIO in dev and CI bootstrap
- replace MinIO in one-click and recommended Docker compose setup
- update self-hosting docs accordingly
- keep the application's existing `S3_*` env contract intact
- keep MinIO-to-new-backend migration explicitly out of scope

---

### 7. References

All substantive product claims above are based on official docs, official repositories, or Formbricks repo inspection unless clearly marked as inference.

#### Formbricks repo evidence

- [`packages/storage/src/client.ts`](../packages/storage/src/client.ts)
- [`packages/storage/src/service.ts`](../packages/storage/src/service.ts)
- [`docker-compose.dev.yml`](../docker-compose.dev.yml)
- [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml)
- [`docker/formbricks.sh`](../docker/formbricks.sh)
- [`docker/migrate-to-v4.sh`](../docker/migrate-to-v4.sh)

#### MinIO / AIStor

- [MinIO README](https://github.com/minio/minio/blob/master/README.md)
- [AIStor documentation home](https://docs.min.io/docs/minio-gateway-for-nas.html)
- [`mc license register` documentation](https://docs.min.io/enterprise/aistor-object-store/reference/cli/mc-license/mc-license-register/)

#### Garage

- [Garage README](https://github.com/deuxfleurs-org/garage/blob/main-v2/README.md)
- [Garage quick start](https://garagehq.deuxfleurs.fr/documentation/quick-start/)
- [Garage S3 compatibility reference](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/)

#### SeaweedFS

- [SeaweedFS README](https://github.com/seaweedfs/seaweedfs/blob/master/README.md)
- [SeaweedFS S3 POST policy handler](https://github.com/seaweedfs/seaweedfs/blob/master/weed/s3api/s3api_object_handlers_postpolicy.go)
- [SeaweedFS bucket CORS handler](https://github.com/seaweedfs/seaweedfs/blob/master/weed/s3api/s3api_bucket_cors_handlers.go)
- [SeaweedFS CORS tests](https://github.com/seaweedfs/seaweedfs/blob/master/test/s3/cors/s3_cors_test.go)

#### Ceph RGW

- [Ceph Object Gateway docs](https://docs.ceph.com/en/quincy/radosgw/)
- [Ceph RGW service docs](https://docs.ceph.com/en/squid/cephadm/services/rgw/)

#### RustFS

- [RustFS README](https://github.com/rustfs/rustfs/blob/main/README.md)
- [RustFS implemented S3 tests](https://github.com/rustfs/rustfs/blob/main/scripts/s3-tests/implemented_tests.txt)

#### Secondary alternatives

- [Scality CloudServer README](https://github.com/scality/cloudserver/blob/development/9.3/README.md)
- [OpenIO SDS README](https://github.com/open-io/oio-sds/blob/master/README.md)
- [CORTX README](https://github.com/Seagate/cortx/blob/main/README.md)
- [OpenMaxIO object browser README](https://github.com/OpenMaxIO/openmaxio-object-browser/blob/openMaxIO-main/README.md)
