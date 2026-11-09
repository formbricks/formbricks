# A v3 response reads as typed answers resolved against today's survey, and writes as stored data

A v3 response comes back self-describing (ENG-2868): `answers[]`, one entry per element with its id, type, label and typed value; `embeddedData[]`, one collection for what used to be variables, hidden fields and auto-captured meta, each entry with a `kind` (`ingested`, `computed`, `reserved`); and `unresolved[]` for stored answers whose element no longer exists, instead of dropping them. An agent holding only a response can tell what was asked without a second call and a join to the survey. Labels are resolved at read time against the current survey, not snapshotted at write time. Comparable survey APIs do the same, and a snapshot would mean a new column and a backfill on the largest table. `resolution.labelPolicy` (`currentSurveyDefinition`) and `resolution.surveyUpdatedAt` say so, so a consumer can see that wording changed after collection. The detailed view also returns the stored `data` unchanged, and writes take that same `data` plus an `embeddedData` map. A client can read a response, edit an answer and send it back without reshaping it. `variables` is neither returned nor accepted: the `embeddedData` read and write already address the same fields by name.

## Considered Options

- **The stored map keyed by element id** (v1/v2): opaque without the survey, mixes question ids with hidden-field keys, and keeps variables, hidden fields and meta as three concepts that behave alike.
- **Reshape `data` to choice ids, additively** (the `poc-expand-response-api` prototype): a caller that doesn't know to ask still gets bare element ids.
- **Snapshot labels at write time**: honest about what the respondent saw, but a schema change on the largest table. If it ever ships, `labelPolicy` gains a second value and consumers branch on it.
- **Also echo stored `variables`**: republishes the storage layout next to the `embeddedData` view of the same fields.

## Consequences

- A response collected under an older headline reads back under today's wording. `labelPolicy` and `surveyUpdatedAt` are the only disclosure.
- Composite answers (matrix, multi-select, address) stay nested as one entry, while a Hub feedback record expands one row per atom. MCP tool descriptions state the boundary between the two.
- Choice matching tries the option id, then the exact label, then `other` only when the value came through the Other input, else `unmatched`. Without the last condition, a renamed option would be filed as a write-in.
- Resolving labels costs a fixed number of batched queries per page, never one per response.
