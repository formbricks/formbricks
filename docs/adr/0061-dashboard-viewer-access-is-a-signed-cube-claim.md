# Dashboard Viewer access is a signed Cube claim

A Feedback Dataset's Dashboard Viewer access (D1, D2) decides which records a Dashboard Viewer's numbers come from. It is enforced in Cube, the only path to Feedback Record data for charts: when a Dashboard Viewer reads a dataset that has conditions, the app resolves the conditions and the viewer's Member attribute values into a `viewerAccess` claim in the signed Cube token, and `queryRewrite` appends it to every query the same way it appends the tenant. The claim names fields and values, never the attribute keys, so Cube needs no access to the app database, and the token signature keeps a caller from widening it.

Matching ignores case and surrounding spaces, and fails closed: a viewer with no value for a condition's attribute gets a filter that matches nothing, and a record whose field is empty never matches. Without conditions, or for anyone who isn't a Dashboard Viewer, there is no claim, so existing viewers see no change until an admin sets conditions. View as mints the claim for the chosen member.

## Considered Options

- **Express access as an extra dashboard filter in the app**: no Cube change, rejected because every caller that builds a query (chart data, filter value lists, MCP) would have to remember it, and a forgotten one leaks rows.
- **A Cube access policy reading attributes from the database**: rejected because Cube would need the app's database and the Member attribute model, and a second evaluator of who is a viewer.

## Consequences

- Every cache of Cube results, including the filter-value cache, is keyed on the claim.
- The claim is bounded (conditions, values per condition, value length) so a token stays small.
- Viewers see their access as locked "Set by your data access" chips; a viewer who matches nothing sees "Your access hasn't been set up" instead of someone else's data.
