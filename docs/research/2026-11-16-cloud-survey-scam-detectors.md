# Cloud survey scam detectors: source research

Research date: 2026-11-16. Question: [Compare scam detectors and the evidence needed for automatic blocking](https://linear.app/formbricks/issue/ENG-7273/research-compare-scam-detectors-and-the-evidence-needed-for-automatic). Parent: [Find a near-term Cloud solution for automatic survey abuse blocking](https://linear.app/formbricks/issue/ENG-7271/find-a-near-term-cloud-solution-for-automatic-survey-abuse-blocking).

This answers a documentation/source question, not an accuracy experiment or a production-readiness approval. No models were executed, customer surveys read, content submitted to providers, access provisioned, or Cloud resources changed. No detector or operational threshold is selected here.

## Finding

Laya offers a genuine self-hosted typed-decision path. Jev is a separate hosted TypeSafe product with its own contract, data boundary and model versions. Hazel is an existing agent identity, whose unattended integration and data-access contract were not established by this research. A constrained hybrid is a feasible design candidate, but none has measured Formbricks survey-blocking accuracy yet.

The [Slack discussion](https://formbricks.slack.com/archives/C08HPFMGFMK/p1794816573680429) contains a small illustrative sample with a benign academic-study false positive and several scams below the chosen cutoff. It is evidence that the toy policy has errors, not an estimate of production precision or recall. The agreed destination requires automatic, reversible survey-level blocking from launch; it does not settle which evidence triggers it.

## Source identity and versions

The linked [laya-ai.com site](https://laya-ai.com/) identifies itself as an independent community resource, not the publisher. Use it as a directory, not as the owning source for capability or accuracy claims.

The upstream [Laya source](https://github.com/NandhaKishorM/laya/tree/80a1da1fa5448ea12163f4d977935625a0aea670) was inspected at commit `80a1da1fa5448ea12163f4d977935625a0aea670`. Its [package metadata](https://github.com/NandhaKishorM/laya/blob/80a1da1fa5448ea12163f4d977935625a0aea670/pyproject.toml) declares version `0.4.34`, Python 3.10+, Apache-2.0, and PyTorch/Transformers plus `vegaml` among its core dependencies. [PyPI metadata](https://pypi.org/pypi/laya/json) independently reported `0.4.34` on the research date. Source inspection is not an installed-package or dependency audit.

Publisher model-card revisions were read through the public Hugging Face API:

| Model                                    | Revision                                   | Card                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `convaiinnovations/laya`                 | `e333cb7c823cd1787276228260f56d02fbf5180b` | [English family card](https://huggingface.co/convaiinnovations/laya/blob/e333cb7c823cd1787276228260f56d02fbf5180b/README.md)                  |
| `convaiinnovations/laya-multilingual`    | `92d22143468d8af669dc1a5a0480a2b21b4fe56e` | [Multilingual card](https://huggingface.co/convaiinnovations/laya-multilingual/blob/92d22143468d8af669dc1a5a0480a2b21b4fe56e/README.md)       |
| `convaiinnovations/laya-typed-decisions` | `989e28febe5886389496fe13a8036c62b2a20ae0` | [Typed-decisions card](https://huggingface.co/convaiinnovations/laya-typed-decisions/blob/989e28febe5886389496fe13a8036c62b2a20ae0/README.md) |

Each card declares Apache-2.0. A chosen deployment still needs a pinned complete artifact/dependency set, including any additional reader used by new runtime paths.

## Comparison

| Candidate                | Established capability                                                                                           | Decision-relevant limit or unknown                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Laya encoder       | Text/JSON state plus typed choice, score and yes/no questions; local Python and HTTP-serving paths.              | Short default token budgets, language routing, unmeasured survey-domain calibration and host capacity.                                        |
| Hosted Jev               | Versioned TypeSafe HTTP API with typed answers; current documented model `jev-1.14.0`.                           | External processor and network dependency; account limits, contracts and domain accuracy unverified.                                          |
| Hazel / generative agent | A generative backend can use a constrained output schema; the existing bot is a potential orchestration surface. | Hazel's actual model, invocation transport, scheduler, credentials, account entitlement, retention and service ownership are not established. |
| Constrained hybrid       | Rules/local scoring can screen content, with an approved second detector for selected cases.                     | This is a proposed architecture, not a deployed capability or independent confirmation of correctness. Measure the combined policy.           |

### Local Laya

The English card describes a 421M-parameter encoder with 512-token context; the multilingual card describes 322M parameters, 1,024 by default and an explicit extension to 8,192 tokens. These budgets include question overhead. They are not a promise that a complete long survey is inspected. The runtime [encoding path](https://github.com/NandhaKishorM/laya/blob/80a1da1fa5448ea12163f4d977935625a0aea670/laya/agent.py#L1210) accounts for truncation; the [HTTP server documentation](https://github.com/NandhaKishorM/laya/blob/80a1da1fa5448ea12163f4d977935625a0aea670/README.md#self-hosting-http-server-jev-compatible) describes truncation reporting. A design must detect omitted content, bound chunking/aggregation, and avoid treating a partial scan as a clean full survey.

The multilingual publisher card claims coverage across 100+ languages, but explicitly says its shipped temperatures are uncalibrated and overconfident, recommends fitting on held-out domain data, and documents weak low-resource-language results. Language coverage is therefore not demonstrated phishing detection quality. The typed-decisions card is fine-tuned for four named workflows; its published benchmark is not a survey-phishing benchmark. Neither the typed output nor a training objective proves calibrated probabilities on Cloud surveys. The publisher's [benchmark notes](https://github.com/NandhaKishorM/laya/blob/80a1da1fa5448ea12163f4d977935625a0aea670/BENCHMARKS.md) also distinguish revised calibration results and training-mix tasks; do not transfer headline email-phishing accuracy to survey blocking.

The [serving implementation](https://github.com/NandhaKishorM/laya/blob/80a1da1fa5448ea12163f4d977935625a0aea670/laya/serve.py) exposes typed HTTP responses, optional bearer-key authentication, input budgets and concurrency controls. Deployment still owns isolation, identity, availability and resource ceilings. The upstream runtime now also exposes a separate [Vega adapter](https://github.com/NandhaKishorM/laya/blob/80a1da1fa5448ea12163f4d977935625a0aea670/laya/vega.py) for additional modalities/long context; these are not capabilities or accuracy guarantees of the original English/multilingual encoder checkpoints. Treat enabling that path as a distinct artifact and evaluation choice.

Inference: local hosting can be designed to keep survey content inside Formbricks-controlled infrastructure. This research did not audit all dependencies, telemetry/hooks or egress. Model loading can fetch artifacts from Hugging Face. Provision pinned weights/dependencies and an explicit network boundary rather than equating the word “local” with verified no egress. There is no vendor per-call inference charge for a local path, but compute, resident models, startup, chunk count, retries and operations still cost money. No production RAM, CPU, GPU or latency budget was measured.

### Hosted Jev

[TypeSafe's model reference](https://docs.typesafe.ai/models) lists `jev-1.14.0`, text/image inputs, 64k per-request and 32k per-question default context, and $0.042 per million input tokens, with output tokens free. It documents organization-specific rate limits and moving aliases; versioned IDs avoid silent alias changes. These are dated vendor specifications, not capacity or cost measured for Formbricks. The [image guide](https://docs.typesafe.ai/images) explicitly describes images/Box as not yet production-ready and requires an opt-in header. Do not infer safe image-based blocking from the presence of vision support.

Jev's [confidence documentation](https://docs.typesafe.ai/confidence) distinguishes a distribution-concentration statistic from the probability an answer is correct. Noul returns the yes-probability without a separate confidence field. Confidence and top probability are not independent corroborating evidence. Vendor example thresholds are not our operating policy; domain-held-out calibration and action-level evaluation remain necessary.

[Request rules](https://docs.typesafe.ai/api/errors) include body/context validation failures, rate limiting and overload responses. Typed answers remove free-form parsing work; they do not make network failures, uncertainty or model judgments deterministic/correct. The service policy must represent “not successfully scanned” separately from allowed or blocked.

[TypeSafe's legal index](https://docs.typesafe.ai/legal) points to its agreements and offers enterprise ZDR by request. Its [privacy policy](https://typesafe.ai/legal/privacy-policy) says services are hosted in the United States and describes retention in general terms. No Formbricks agreement, enterprise ZDR setting, approved transfer boundary or regional deployment was verified. A hosted API must not receive customer survey content merely because the per-token price is low.

### Hazel / generative backend

The Slack bot's offer to process a feed does not establish an authenticated unattended input/output contract. No Hazel runtime configuration was inspected here. Verify its owner, supported trigger mechanism, exact model/backend, quotas, retries, auditability and processor boundary before comparing it as an operational service.

For an OpenAI API implementation, [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrain completed non-refusal outputs to a supported schema, but still require handling refusals, incomplete responses, errors and semantic mistakes. A schema is not a correctness or repeatability guarantee. [Agent safety guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety) treats untrusted-input prompt injection as a risk and recommends constrained data flow. Inference for this design: the detector should return a verdict/evidence record without tools or blocking credentials; a separate bounded policy component should own enforcement.

[OpenAI billing guidance](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform) separates ChatGPT and API billing, while noting eligible promotional API credits. Subscription headroom alone therefore does not establish API entitlement, zero marginal cost, or a supported unattended Hazel integration. Verify the actual account and integration rather than assuming either that it is available or impossible.

For OpenAI API processing, [data controls](https://developers.openai.com/api/docs/guides/your-data) say API content is not used for training by default, while default abuse-monitoring logs may retain content for up to 30 days; approved ZDR/modified monitoring have eligibility and feature limits. Those API statements do not establish Hazel's actual product surface or configuration. Cost depends on selected model, input/output and reasoning tokens, images, retries and any tools; no model choice or cost estimate is asserted here.

## Evaluation evidence still required

The following is a proposed evaluation design, not work performed or a policy decision:

1. Agree the phishing/scam labeling rubric before tuning. Include legitimate security-awareness questionnaires, academic studies, ordinary contact/incentive/payment-related research and first-party authentication examples that should not be confused with credential harvesting. Label complete survey versions; adjudicate ambiguous cases with a human owner.
2. Assemble an approved, minimized representative corpus with known abusive and benign examples. Keep campaign/organization families and paraphrases out of both tuning and final test sets. Synthetic cases supplement real representativeness; they cannot establish production prevalence or false-positive cost alone.
3. Stratify tests by language/script, mixed languages, spacing and Unicode obfuscation, question type, rich text, links/redirects, credential/payment/seed-phrase requests, images, long content and relevant post-publication edits. Include harmful text beyond truncation boundaries and text spread across elements. Distinguish unsupported coverage from a clean verdict.
4. Include instructions embedded in survey text that try to change the classification, claim to be system messages or request tool actions. Evaluate an isolated detector with no browser/tool authority, plus safely extracted evidence. Do not fetch arbitrary linked destinations as an implicit part of classification.
5. Measure the actual block/allow/review policy, not only model accuracy: automatic-block precision and benign-block rate, recall by abuse type/language, abstention/review volume, and uncertainty intervals with denominators. Evaluate calibration/reliability on held-out data and inspect every false block. Real abuse prevalence is needed to project precision and review load.
6. Pin model/runtime, checkpoint, question/rule versions, extraction, language routing, chunk aggregation and numerical backend. Test repeated verdicts, upgrades and near-boundary changes. Two correlated model outputs or a rule plus a model are not automatically independent evidence.
7. Validate failure cases: truncation, malformed/refused output, unsupported media/language, timeout, overload, stale content versions, queue backlog and budget exhaustion. Measure publication/edit-to-decision and enforcement delay separately; inference latency alone does not meet a blocking-delay objective.
8. Bhagya's policy decision must select acceptable false-positive/missed-abuse limits, corpus sufficiency, automatic-block triggers and unresolved-case behavior. The architecture decision must establish the approved processing boundary and an enforceable reversible block. This research selects none of those values and does not authorize a customer-content experiment.

## Ready for the next decision

The available integration families and material caveats are established well enough to discuss [the abuse policy and required evidence](https://linear.app/formbricks/issue/ENG-7274/grill-choose-the-abuse-policy-and-evidence-required-for-automatic). Production accuracy, corpus access/approval, Hazel's actual unattended contract, hosted-processor approval and target-host capacity remain explicit evidence gates. A detector is not the survey feed, content-version guard or persistent blocking mechanism; those are addressed by the sibling research and architecture decisions.
