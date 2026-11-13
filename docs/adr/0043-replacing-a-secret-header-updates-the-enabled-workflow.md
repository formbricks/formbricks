# Replacing a secret header updates the enabled workflow at once

A secret header's value lives encrypted in its own `WorkflowSecret` row, and the workflow definition and every version store only `{name, secretId}`. Replace overwrites that row in place, so the enabled version uses the new value from its next run, without a new Enable (ENG-7168). Everything else in a workflow only goes live when it is enabled, which makes this the one exception; it exists because rotating a leaked or expired API key must not wait for, or be bundled with, unrelated draft changes. The editor says so before saving: "This also updates the enabled workflow right away."

## Considered Options

- **Replace creates a new secret row**: versions stay exact snapshots and a key change goes live through Enable like any other change, but rotating a key would also publish whatever else sits in the draft.
- **Encrypted values inside the definition JSON**: no extra table, but the ciphertext would be copied into every version, duplicate and audit snapshot, and every reader would have to remember to strip it.

## Consequences

- A typo in a replaced value breaks live runs immediately; "Send test request" uses the same row, so authors can check it first.
- A version does not pin its secret values. Restoring an old version (ENG-7119) will run with today's values.
- Duplicates copy the header names but not the values, and can't be enabled until the values are entered again.
