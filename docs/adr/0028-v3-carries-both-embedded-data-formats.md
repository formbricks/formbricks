# The v3 survey document carries both Embedded Data formats, and refuses a mismatch

The v3 survey document spoke only the legacy `variables` and `hiddenFields`, which are a projection of the survey's Embedded Data fields. Computed date fields and workspace library fields can't be expressed in that projection, so v3 also exposes `embeddedFields`: typed computed and ingested fields, including library fields linked by key. Existing clients keep sending the legacy format. Either format alone is accepted; sent together, they must describe the same fields, or the call fails with a 400 naming the exact path. GET returns both, and the legacy format stays derived from `embeddedFields`. Logic operands don't change: `variable` and `hiddenField` are the storage keys of computed and ingested fields.

## Considered Options

- **Add `date` to the legacy `variables` types only**: the smallest change, but library fields, typed defaults and locked ingested fields stay out of reach of the API.
- **Let one format win when both are sent**: never refuses, but a client that edits one format while echoing back the other loses its change without noticing.

## Consequences

- A computed date field appears only in `embeddedFields`; readers of the legacy format don't see it.
- The public API links library fields before the Embedded Data vs contact-attribute model is settled (ENG-6652, ENG-1856), so that decision has to keep these links working.
