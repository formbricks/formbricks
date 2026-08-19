# The scenario corpus

The contract. The `.zed` files are implementations of _this_, and every assertion in the three
validation suites carries its scenario ID as a comment so it traces back to a source.

Harvested, not invented. Sources in priority order: the existing parity suite
(`authzed/schema-validation.yaml`), the FigJam working board, the Notion "Auth questions and
answers" page, BI's stated requirements, and the requirement tables in `ENTERPRISE-REQUIREMENTS.md`.

| ID             | Scenario                                                                                                                                                                                                                                               | Verdict | Source                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------- |
| **P1.1–1.5**   | Org owner/manager reach every shared container and everything in it; billing reaches billing surfaces                                                                                                                                                  | allow   | parity suite                                                    |
| **P2.1–2.4**   | Team-derived access flows to leaves; team admin manages the team                                                                                                                                                                                       | allow   | parity suite                                                    |
| **P3.1–3.4**   | The billing role is excluded from product data **even when it holds a team row**                                                                                                                                                                       | deny    | parity suite (the load-bearing `bella` case)                    |
| **P4.1–4.2**   | An org member in no team reaches nothing                                                                                                                                                                                                               | deny    | parity suite                                                    |
| **P5.1–5.2**   | A team row without an org membership is not membership                                                                                                                                                                                                 | deny    | parity suite (`ghost`, defence in depth)                        |
| **N1.1–1.10**  | A personal container: the owner reaches it; org admins may `administer` (transfer, delete) but **not** `read`                                                                                                                                          | mixed   | FigJam §I.3 "Personal workspace per user"; Notion offboarding Q |
| **N2.1–2.2**   | Legal hold: an explicit grant makes a private container readable                                                                                                                                                                                       | allow   | banks / e-discovery; DORA 21(a)                                 |
| **N3.1–3.9**   | An external agency guest reads exactly one survey — not the container, not another survey, not contacts, not dataset records, cannot write, share or export                                                                                            | mixed   | BI; Notion "external users are view-only always"                |
| **N4.1, 4.3**  | `summary` is strictly below `read`: aggregates without individual responses                                                                                                                                                                            | mixed   | FigJam locked decision                                          |
| **N5.1–5.3**   | A division-level grant flows down to a leaf three levels deep; a sub-unit grant does **not** leak upward                                                                                                                                               | mixed   | backlog R20; BI divisions                                       |
| **N6.1–6.6**   | A pool assigned to two containers is visible to the union of their viewers; targeting flows from an assignment; **PII never does**                                                                                                                     | mixed   | FigJam 🔵 Assignment + rule 4; I-7                              |
| **N7**         | API-key ladder: read / write / manage act only within granted scope                                                                                                                                                                                    | allow   | parity suite                                                    |
| **N8.1**       | An expired grant is denied                                                                                                                                                                                                                             | deny    | I-5; ISO A.8.2; DORA 21(e)(ii)                                  |
| **N9.1**       | An editor cannot re-share                                                                                                                                                                                                                              | deny    | FigJam locked decision                                          |
| **N10**        | Response export is not implied by read                                                                                                                                                                                                                 | deny    | RFC goal; ISO A.8.3 verb granularity                            |
| **N11**        | No grant crosses an organization boundary                                                                                                                                                                                                              | deny    | FigJam rule 3; CCM IVS-09                                       |
| **N12.1–12.4** | Segregation of duties: `manage` does not imply the right to grant, and granting does not imply reading                                                                                                                                                 | mixed   | ISO A.5.3/A.5.18; DORA 21(e)(i); ORP.4.A4                       |
| **N13.1**      | A customer-defined role is a group of people bound at a standard tier, and does not leak past it                                                                                                                                                       | mixed   | ORP.4.A16/A17                                                   |
| **N14.1–14.4** | Break-glass is its own time-boxed relation: it reaches read and export, expires, and is not ownership                                                                                                                                                  | mixed   | DORA 21(a)/(e)(ii); ORP.4.A20                                   |
| **N15.1–15.7** | Works council and manager-scoped EX: a manager sees their own org unit and below but not the parent; a scoped works council sees its own scope; scores do not imply verbatims; raw export is never bundled in; content access is not respondent access | mixed   | BetrVG §87(1)(6), §80; W1–W4                                    |

## Deliberate departures from today's behaviour

These are **not** parity. Each closes a logged issue and each is asserted:

- `response_export` is no longer the same gate as `read` (I-3, C3).
- `view_contacts` never flows from container access or a survey share (I-7, C12).
- Content carries a transferable `owner`; `createdBy` stays immutable attribution (I-27, FigJam rule 7).
- `manage_access` is separable from `manage` (C4).
- Grants can expire (I-5, C8).
- Containers nest (R20).

## Scenarios deliberately NOT modelled

- **Response-level relationships.** 3–4M rows are the board's ⚫ Excluded edge. Response
  authorization stays parent-derived, as `apps/web/lib/authorization/resolvers.ts:172` already does.
- **Minimum-response thresholds, complementary suppression, cross-tabulation caps, region
  predicates.** All POLICY (W9–W15). A relationship graph cannot express "only if the result set has
  at least five rows", and trying makes it slower and wrong.
- **Four-eyes approval, recertification campaigns, audit-log storage.** POLICY and SURFACE (C13–C16).
- **Share links as principals.** Backlog R5; capability tokens until then.
- **Field-level ACLs.** Better modelled as a permission on a sub-resource than as true field ACLs.
