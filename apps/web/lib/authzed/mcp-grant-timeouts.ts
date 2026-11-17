/**
 * Transaction timeouts for the paths that lock MCP grant rows, in a module of their own so a caller that
 * ends grants inside its own transaction (member removal, demotion, the retention sweep, SSO recovery)
 * can size it without loading the grant store or the SpiceDB projection.
 */

/**
 * How long one reconciling pass may hold its grants' row locks, SpiceDB round trips included. A path that
 * locks a grant row `FOR UPDATE` (a save, a Revoke) can wait this long behind one, so its own transaction
 * timeout allows for it (`grant-store.ts`).
 */
export const MCP_GRANT_PROJECTION_TRANSACTION_TIMEOUT_MS = 30_000;

/**
 * How long before its transaction times out a reconciling pass stops writing to SpiceDB. Each write
 * carries the pass's deadline as its gRPC deadline, so SpiceDB abandons one still under way by then. A
 * write that misses it may still commit just after (the datastore commit already sent), so the pass keeps
 * its row locks through this margin before it fails (`mcp-grant.ts`). The margin is a heuristic bound on
 * that commit, not a guarantee: a narrowing reconciles its grant again once it commits, which repairs a
 * write that lands later still.
 */
export const MCP_GRANT_PROJECTION_WRITE_MARGIN_MS = 5_000;

/**
 * How long a transaction that saves a grant may run. It locks the grant row `FOR UPDATE`, which can wait
 * behind a reconciling pass for up to `MCP_GRANT_PROJECTION_TRANSACTION_TIMEOUT_MS` (see
 * {@link MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS}), and then deletes what a narrowing takes away from
 * SpiceDB before it commits, for which 15 seconds cover a SpiceDB retry.
 */
export const MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS = MCP_GRANT_PROJECTION_TRANSACTION_TIMEOUT_MS + 15_000;

/**
 * How long Revoke's transaction may run. Its first grant-row step, `FOR UPDATE`, can wait behind a
 * reconciling pass that holds the row `FOR SHARE` across its SpiceDB calls for up to
 * `MCP_GRANT_PROJECTION_TRANSACTION_TIMEOUT_MS`; the app client's 20-second budget
 * (`APP_TRANSACTION_TIMEOUT_MS` in `@formbricks/database`) would then fail a Revoke the user asked for,
 * while it was only waiting its turn. So Revoke allows the reconciler's whole bound, plus
 * the few writes of its own. The other way round, a reconciler that dropped the lock across SpiceDB calls,
 * would reopen the race the lock closes (a reconcile writing back what a narrowing just deleted), so the
 * wait is allowed for rather than removed.
 */
export const MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS = MCP_GRANT_PROJECTION_TRANSACTION_TIMEOUT_MS + 5_000;
