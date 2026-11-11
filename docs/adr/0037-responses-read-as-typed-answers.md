# A v3 response reads as typed answers resolved against today's survey, and writes as stored data

A v3 response comes back self-describing (ENG-2868): `answers[]` with each element's id, type, label and typed value; `embeddedData[]` as one collection for what used to be variables, hidden fields and auto-captured meta; and `unresolved[]` for stored values it recognizes but can't place, such as an answer whose element was deleted, instead of dropping them silently. An agent holding only a response can tell what was asked without a second call to the survey. Labels are resolved at read time against the current survey, not snapshotted, and `resolution.labelPolicy` and `resolution.surveyUpdatedAt` disclose it. The detailed view also returns the stored answers in `data` with their values unchanged, and writes take that `data` plus an `embeddedData` map, so an answer can be read, edited and sent back; `variables` is neither returned nor accepted.

## Considered Options

- **The stored map keyed by element id** (v1/v2): opaque without the survey, and mixes question ids with hidden-field keys.
- **Snapshot labels at write time**: honest about what the respondent saw, but a new column and a backfill on the largest table. If it ever ships, `labelPolicy` gains a second value.

## Consequences

- A response collected under an older headline reads back under today's wording.
- The read and write shapes are close but not identical. The read withholds some stored values (legacy values outside the published shapes among them) and includes entries a write refuses, and a PATCH of `data` replaces the whole answer map, so sending the read straight back can delete what it withheld. An empty `unresolved[]` doesn't prove nothing was withheld.
- Composite answers stay nested as one entry, while a Hub feedback record has one row per atom.
