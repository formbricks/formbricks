# Matrix conditions move from positions to ids, keeping positions for one release

A matrix condition stores its row as an index (`leftOperand.meta.row`) and its column as an index in the right operand, so reordering rows or columns on a live survey silently points it at another cell (deleting and renaming are already locked, ADR 0020). Conditions switch to row and column ids. Upgrades are rolling, and the previous release's pods re-validate every survey they serve, so a data migration adds the ids next to the positions in every stored condition (block logic, quota conditions and follow-up conditions) rather than replacing them. 6.2 writes both and reads ids first; positions are dropped in a later release. New show-if conditions are written the same way from day one.

## Considered Options

- **Keep positions and remap them on every reorder**: no format change and no migration, but every write path has to rewrite conditions, and AI keeps writing positions.
- **Ids for new conditions only, no migration**: old conditions keep the reorder bug until someone edits them.
- **Replace positions in the migration**: old pods would reject the converted surveys while the upgrade rolls out.

## Consequences

- Until positions are dropped, every write path keeps both in sync, and ids win when they disagree.
- Dropping positions removes a field API clients can read, so it goes in a breaking-changes table, not in a minor release.
- The migration follows the data-migration rules in `docs/agents/self-hosting-config.md` (cursor reads, inside the runner's timeout).
