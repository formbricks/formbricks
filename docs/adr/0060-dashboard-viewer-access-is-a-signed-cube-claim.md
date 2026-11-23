# Dashboard Viewer access is enforced in Cube from a signed claim

A Feedback Dataset's Dashboard Viewer access (P-ENG-110) is resolved by the app into the conditions plus the viewer's member attribute values. It travels as a claim in the signed Cube JWT, and `queryRewrite` in `docker/cube/cube.js` appends it to every query, the same way it appends the tenant. Appending it in the app before each Cube call was rejected: chart data, dashboard filter value lists, MCP and View as all reach Cube on separate paths, and one forgotten path would show a viewer other people's records. The claim fails closed. A viewer whose member attribute is empty gets a condition that matches nothing, and the app shows "Your access hasn't been set up". Any cache of Cube results is keyed on the claim.

## Consequences

- Conditions match only string fields of the Feedback Record itself, embedded-data keys included, never question answers or measures. Matching ignores case and surrounding spaces. A record whose field is empty never matches.
- The claim is absent for anyone who is not a Dashboard Viewer and for datasets without Dashboard Viewer access. Its presence, not the caller's role, is what Cube trusts.
- The upgrade changes nothing for existing Dashboard Viewers: no dataset has Dashboard Viewer access until an Owner or Manager adds conditions, so no claim is minted and they keep seeing every record. The fail-closed empty case only applies after conditions exist, which View as is there to check.
