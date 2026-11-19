import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { getMcpGrantForActor } from "@/lib/authorization/context";
import { cache } from "@/lib/cache";

/**
 * How long a dashboard-bound read decision is reused. A dashboard opens with one request per widget and a
 * value list per filter, each asking the same questions of PostgreSQL and SpiceDB — the caller's role, the
 * workspace grant, the plan, each dataset; half a minute spares those while a lost grant still stops
 * reads soon after.
 */
export const DASHBOARD_READ_DECISION_TTL_MS = 30_000;

/**
 * `decide`, answered for 30 seconds from the cache for the same principal, dashboard version and
 * `decision` (the dashboard itself, or one of its datasets). Only an allowed decision is kept: a refusal
 * is asked again every time, so a caller just granted access does not wait. A saved dashboard moves its
 * `updatedAt`, which starts over. Without a principal, under an MCP grant that selects organizations or
 * workspaces, or with the cache down, it decides every time.
 */
export const withCachedDashboardDecision = async <T extends object>(
  {
    dashboard,
    principal,
    decision,
  }: { dashboard: { id: string; updatedAt: Date }; principal: string | null; decision: string },
  decide: () => Promise<Response | T>
): Promise<Response | T> => {
  // An MCP grant limited to selected organizations or workspaces (ADR-0042) decides less than its user
  // may: an allow the user's REST read, or a client with All access, kept here must never reach it, and a
  // narrowed client's decision must not be kept for the others either. Decided every time.
  if (!principal || getMcpGrantForActor({ type: "user", id: principal })) return decide();

  // The principal is a user or API key id, and the decision names a dataset by id: nothing secret, and
  // short, so the key holds them as they are.
  const key = createCacheKey.custom(
    "analytics",
    dashboard.id,
    `read-decision:${principal}:${dashboard.updatedAt.getTime()}:${decision}`
  );

  const cached = await cache.get<T>(key);
  if (cached.ok && cached.data) return cached.data;

  const decided = await decide();
  if (!(decided instanceof Response) && cached.ok) {
    await cache.set(key, decided, DASHBOARD_READ_DECISION_TTL_MS);
  }
  return decided;
};
