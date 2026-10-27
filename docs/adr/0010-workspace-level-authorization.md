# Authorize creatives at the workspace level, not in SpiceDB

Creatives follow the dashboard pattern: `read` members view, `readWrite` members edit, decided on the workspace node, with no SpiceDB `creative` definition (ENG-3916). Every check goes through the helpers in `modules/ee/creatives/lib/authorization.ts` (`authorizeCreativeWorkspace`, `authorizeCreative`, `authorizeCreativePage`), so a per-creative model later changes one place. A SpiceDB definition would force every self-hoster to run a manual upgrade step, which counts as breaking, and nothing in 6.2 needs per-creative access because Restricted surveys can't be Destinations.

## Consequences

- The Enterprise license gate added later (ENG-6602, `getCreativesAccess`) runs on top of this check and does not replace it: a member still needs workspace access, and the license then decides whether Creatives are fully available, in wind-down or absent.
