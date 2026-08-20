# Enterprise requirements evidence base

Formbricks Cloud cannot answer this — the enterprises self-host, so their usage is invisible.
The evidence therefore comes from three places: what comparable enterprise XM products ship,
what compliance regimes actually require, and what German co-determination law makes
non-negotiable. Each requirement is classified:

- **SCHEMA** — constrains the authorization data model. Expensive to retrofit. Design in now.
- **POLICY** — an application-side predicate at query time.
- **SURFACE** — UI, reporting or audit only.

Severity: **blocking** (deals fail) / **expected** / **nice-to-have**.

---

## 1. What comparable XM products ship

|                            | Container(s) between tenant and survey                    | Container == people-group?   | Content owned by | Offboarding                                                                 |
| -------------------------- | --------------------------------------------------------- | ---------------------------- | ---------------- | --------------------------------------------------------------------------- |
| **Qualtrics**              | Division (admin) + Group (content) + Org Hierarchy (data) | **No — separate on purpose** | **User**         | bulk "Transfer Surveys"; EX dashboards do **not** transfer                  |
| **SurveyMonkey Ent.**      | Division (admin) + Workgroup (collab)                     | **No — separate on purpose** | **User account** | deleting the account **destroys surveys shared with others**                |
| **Alchemer**               | Team (+ folders)                                          | Yes                          | **Team**         | _"The surveys are preserved as is, including the team"_ — no tooling needed |
| **Medallia**               | Organization → Unit Group → Unit                          | No (units ≠ users)           | no owner         | non-event                                                                   |
| **SAP SuccessFactors RBP** | none — populations                                        | group is the model           | no owner         | non-event (attribute-driven)                                                |
| **Forsta**                 | Company + system-level user group                         | Yes                          | Company          | non-event                                                                   |
| **Sprig**                  | Product → Environment                                     | n/a (no groups)              | Account          | undocumented                                                                |

Three findings carry weight:

1. **Two of the three largest independently run two containers** and both publish a paragraph whose
   only job is to stop customers confusing them. SurveyMonkey's is the crispest: _"Divisions help
   with administrative management of large teams while Workgroups help organize team members
   collaborating on survey projects."_ Formbricks already has this split (Team ≠ Workspace) and
   should not regress it.
2. **User-owned content is the mistake, paid for twice in public.** Qualtrics and SurveyMonkey both
   had to build transfer tooling and both tools leak. Alchemer, which put ownership on the
   container, needs none. Formbricks is currently on Alchemer's side; keep it there.
3. **The gaps are not containers — they are what hangs off them.** Separately-permissioned shared
   asset pools (4/6 have them, Formbricks has none), custom roles (5/6), field-level restricted
   data (3/6 — precisely the three that sell into HR and regulated buyers), and IdP-attribute →
   container mapping.

| #   | Requirement                                                         | Class                                      | Severity                               |
| --- | ------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| X1  | Org-level shared asset pools, permissioned independently of surveys | **SCHEMA**                                 | blocking                               |
| X2  | Custom roles the customer defines                                   | **SCHEMA**                                 | expected; blocking in DE public sector |
| X3  | Content owned by a container, not a user                            | **SCHEMA**                                 | blocking                               |
| X4  | Two groups at different levels on one body of work                  | **SCHEMA**                                 | expected                               |
| X5  | Delegated administration below the tenant                           | SCHEMA + SURFACE                           | expected                               |
| X6  | IdP attribute / SCIM group → container mapping                      | SCHEMA (group as subject) + SURFACE (SCIM) | expected                               |
| X7  | Field-level restricted data (PII fields)                            | SCHEMA (separate verb) + POLICY            | blocking for HR buyers                 |

---

## 2. Compliance regimes

Sourced from ISO/IEC 27001:2022 Annex A, AICPA TSC CC6, GDPR, BSI IT-Grundschutz ORP.4, and
DORA RTS (EU) 2024/1774 Art. 20–21. **Note for bank questionnaires:** BAIT was withdrawn for
DORA-scoped entities on 17 Jan 2025 and is fully repealed 31 Dec 2026 — answer against the DORA
RTS, which is both current and more specific.

| #   | Requirement                                                                                                                                  | Source                                                                                                          | Class                                       | Severity                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| C1  | Every object rooted in exactly one tenant, no ambient cross-tenant relations                                                                 | CCM IVS-09                                                                                                      | **SCHEMA**                                  | blocking                                  |
| C2  | A resource hierarchy where a grant can attach at any level. _"If grants only exist at org level, every other requirement is unsatisfiable."_ | ISO A.8.3, ORP.4.A2/A7, DORA 21(a)                                                                              | **SCHEMA**                                  | blocking                                  |
| C3  | Verb granularity: read / write / delete / **export** / share / manage_access as separate permissions                                         | ISO A.8.3                                                                                                       | **SCHEMA**                                  | blocking                                  |
| C4  | `manage_access` (grant/revoke) distinct from admin — segregation of duties                                                                   | ISO A.5.3 + A.5.18 (_"approval and implementation … handled by separate individuals"_), DORA 21(e)(i), ORP.4.A4 | **SCHEMA**                                  | blocking                                  |
| C5  | Groups as first-class subjects on every relation                                                                                             | ORP.4.A1/A15                                                                                                    | **SCHEMA**                                  | blocking                                  |
| C6  | Custom roles — the system must represent _the institution's_ role model                                                                      | ORP.4.A16, A.17                                                                                                 | **SCHEMA**                                  | expected; blocking DE public sector/banks |
| C7  | Non-human principals with their own scoped grants, not "inherits the creator"                                                                | ISO A.5.16, DORA 20(2)(a), 21(c)                                                                                | **SCHEMA**                                  | expected                                  |
| C8  | Expiring grants — built-in, not an application cron                                                                                          | ISO A.8.2, DORA 21(e)(ii), AuthZed best practice #27                                                            | **SCHEMA**                                  | expected                                  |
| C9  | Break-glass as its own relation, never "temporarily make them an admin"                                                                      | DORA 21(a), 21(e)(ii), ORP.4.A20                                                                                | **SCHEMA**                                  | expected; blocking for banks              |
| C10 | Grants enumerable in both directions (who can reach X / what can X reach)                                                                    | BAIT _"vollständig und nachvollziehbar ableitbar"_, SOC 2 evidence                                              | **SCHEMA**                                  | blocking                                  |
| C11 | Default-closed: a new resource is reachable by nobody until granted                                                                          | GDPR Art. 25(2)                                                                                                 | **SCHEMA**                                  | blocking                                  |
| C12 | Separate "see the survey" from "see identified respondent data"                                                                              | GDPR Art. 5(1)(f)/25, SDM _Nichtverkettung_                                                                     | **SCHEMA**                                  | blocking for EX                           |
| C13 | Periodic access review / recertification                                                                                                     | ISO A.5.18, DORA 21(e)(iv), CCM IAM-08                                                                          | **SURFACE** (needs C10)                     | blocking                                  |
| C14 | Recertification interval                                                                                                                     | DORA: 12 months, 6 for critical; CCM leaves it risk-based                                                       | **POLICY** — configurable, never hard-coded | blocking                                  |
| C15 | Audit log of every access-rights change and of data access                                                                                   | ISO A.5.18/A.8.3, CCM IAM-12                                                                                    | **SURFACE**                                 | blocking                                  |
| C16 | Four-eyes for admin actions                                                                                                                  | ORP.4.A24 (_erhöhter Schutzbedarf_, SOLLTE)                                                                     | **POLICY**                                  | nice-to-have                              |
| C17 | Toxic-combination / SoD conflict detection                                                                                                   | DORA 21(b)                                                                                                      | **POLICY** (needs C3/C4)                    | expected                                  |
| C18 | SSO, MFA, SCIM, data residency                                                                                                               | ORP.4.A10/A18, CCM DSP-19                                                                                       | **SURFACE / deployment**                    | blocking, but not authorization           |

**The self-hosted inversion, and it changes where to spend:** for Bosch, Siemens, BI and public
sector, _the customer_ holds the ISO 27001 certificate and runs the recertification campaign.
Formbricks' obligation is not to be compliant — it is to be **auditable and configurable**:
enumerable permissions, exportable role/assignment reports, and the ability to represent _their_
role model rather than imposing ours (ORP.4.A17 is literally that requirement). Spend on schema
granularity, custom-role indirection and reporting surfaces; do **not** build recertification
campaign workflows into the product.

---

## 3. German co-determination — the non-negotiables

Employee surveys at Bosch/Siemens/BI are co-determined. **BetrVG § 87(1)(6)** covers _"technische
Einrichtungen, die dazu bestimmt sind, das Verhalten oder die Leistung der Arbeitnehmer zu
überwachen"_, and _"dazu bestimmt"_ is read **objectively** — suitability suffices, intent is
irrelevant. Aggregation does not exempt you. A Betriebsvereinbarung (for a group: a
Konzernbetriebsvereinbarung) is the entry ticket, not a risk.

**BAG 11.12.2018 – 1 ABR 13/17** is the commercially important holding: once the _platform_ was
introduced with works-council consent, later changes to question content were **not** separately
co-determined. Read structurally, that means **the permission model, not the questionnaire, is the
co-determined artifact** — and therefore that changing the permission model is a re-triggering
event. Design it to be versioned, diffable and stable.

**Anonymity is the legal basis, not a feature.** _"Echte Anonymität setzt voraus, dass eine solche
Re-Identifizierung ausgeschlossen ist; bleibt nur die Zuordnung erschwert, liegt allenfalls eine
Pseudonymisierung vor und die Daten bleiben personenbezogen."_ Genuinely anonymous data fall
outside GDPR entirely; pseudonymous data bring the whole regime. And **EuGH C-65/23 (19.12.2024)**
settled that a works agreement cannot legitimise processing the GDPR forbids — so "the BV covers
it" is not a sellable answer.

| #   | Requirement                                                                                                                             | Class                  | Typical value                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------- |
| W1  | Org-unit hierarchy, traversable, versioned at survey close so a reorg cannot rewrite history                                            | **SCHEMA**             | —                                       |
| W2  | Manager-of-record edges distinct from the unit tree (matrix orgs have both)                                                             | **SCHEMA**             | —                                       |
| W3  | Works-council role **scoped** to site / company / group (BR / GBR / KBR) — never global read-all                                        | **SCHEMA**             | —                                       |
| W4  | `view_scores`, `view_comments`, `view_response_rate`, `export_raw` independently grantable                                              | **SCHEMA**             | —                                       |
| W5  | Participation data and response data separated with no reachable join key                                                               | **SCHEMA**             | —                                       |
| W6  | Per-attribute sensitivity classification                                                                                                | **SCHEMA**             | —                                       |
| W7  | Jurisdiction / legal-entity attribute, orthogonal to the org tree                                                                       | **SCHEMA**             | —                                       |
| W8  | Permission model exportable as a document (_Anlage: Berechtigungsverzeichnis_) and report catalogue likewise (_Auswertungsverzeichnis_) | **SURFACE**, needs C10 | —                                       |
| W9  | Minimum responses before scores are shown                                                                                               | **POLICY**             | default **5**, range 3–10               |
| W10 | Minimum responses before **comments** are shown — separately configurable, higher                                                       | **POLICY**             | **10** (Viva Glint default)             |
| W11 | Complementary suppression of the next-largest sibling to defeat subtraction                                                             | **POLICY**             | Glint default 2                         |
| W12 | Per-filter minimum — reject a filter term below threshold _even if the result set passes_                                               | **POLICY**             | = reporting minimum                     |
| W13 | Sub-threshold units still roll **into** ancestor aggregates while their own report is suppressed                                        | **POLICY over SCHEMA** | always on                               |
| W14 | Manager visibility depth cap below own node                                                                                             | **POLICY**             | 2 levels observed in one DE negotiation |
| W15 | Viewer-region × data-region predicate, orthogonal to the hierarchy                                                                      | **POLICY**             | per BV                                  |
| W16 | Raw-data retention TTL after reporting                                                                                                  | **POLICY**             | ~30 days                                |
| W17 | Tamper-evident audit log incl. **denied** attempts, readable by the works council                                                       | **SURFACE**            | —                                       |

**No German law prescribes a number.** The 5/7/10 values are negotiated practice — one source calls
them explicitly arbitrary — and they converge with vendor defaults (Glint 5/10, Qualtrics 5,
Culture Amp configurable). **Build them as per-tenant, per-survey configuration with a change audit,
locked once responses exist. Never as constants.**

W13 is the one most likely to be got wrong: a naive implementation filters sub-threshold responses
out entirely and produces wrong company-level numbers.

---

## A note on where these came from

Everything above is sourced from standards, case law, vendor documentation and comparable products.
**None of it is a Formbricks customer stating a requirement in their own words.** That evidence is
still outstanding — Jodie and Kris are writing user stories from the Boehringer Ingelheim and CMS
calls. Treat this document as the floor a serious enterprise buyer will hold us to, not as a
substitute for asking. Where a schema element rests on inference rather than a source, it is marked
INFERRED in `candidate-a-container.zed` and listed in `README.md`.

## Confidence

Verifiable primary sources: GDPR, BetrVG, BSI ORP.4, DORA RTS, AICPA TSC, and all vendor
documentation. ISO 27001/27002 control text is copyrighted and quoted via consultancies that
reproduce it consistently. SIG and VSA question text is proprietary and was not obtained. The
German threshold numbers come largely from survey vendors, who agree with each other and with
product defaults — convergent, but not law. Two secondary-sourced items are flagged in the
underlying research and should be re-checked before external use: LAG Niedersachsen 2 SLa 31/24,
and the current status of the draft Beschäftigtendatengesetz.
