# A v3 response reads as typed answers resolved against today's survey, and writes as stored data

A v3 response comes back self-describing (ENG-2868): `answers[]` with each element's id, type, label and typed value; `embeddedData[]` as one collection for what used to be variables, hidden fields and auto-captured meta; and `unresolved[]` for answers whose element no longer exists. An agent holding only a response can tell what was asked without a second call to the survey. Labels are resolved at read time against the current survey, not snapshotted, and `resolution.labelPolicy` and `resolution.surveyUpdatedAt` disclose it. The detailed view also returns the stored answers in `data` with their values unchanged (hidden-field keys and `verifiedEmail` are withheld), and writes take that `data` plus an `embeddedData` map, so a response can be read, edited and sent back; `variables` is neither returned nor accepted.

## Considered Options

- **The stored map keyed by element id** (v1/v2): opaque without the survey, and mixes question ids with hidden-field keys.
- **Snapshot labels at write time**: honest about what the respondent saw, but a new column and a backfill on the largest table. If it ever ships, `labelPolicy` gains a second value.

## Consequences

- A response collected under an older headline reads back under today's wording.
- Composite answers stay nested as one entry, while a Hub feedback record has one row per atom.
