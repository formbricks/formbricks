import { beforeEach, describe, expect, test, vi } from "vitest";
import { cache } from "@/lib/cache";
import { DASHBOARD_READ_DECISION_TTL_MS, withCachedDashboardDecision } from "./read-decision-cache";

vi.mock("server-only", () => ({}));
// The unit setup fakes hashing; the key is what tells decisions apart, so hash for real.
vi.mock("node:crypto", async (importOriginal) => await importOriginal());
vi.mock("@/lib/cache", () => ({ cache: { get: vi.fn(), set: vi.fn() } }));

const store = new Map<string, unknown>();
const parts = {
  dashboard: { id: "cldb000000000000000000001", updatedAt: new Date("2026-11-02T00:00:00Z") },
  principal: "user_1",
  decision: "dashboard",
};
const ACCESS = { workspaceId: "ws", organizationId: "org", asDashboardViewer: true };

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  vi.mocked(cache.get).mockImplementation(
    async (key) => ({ ok: true, data: store.get(key) ?? null }) as never
  );
  vi.mocked(cache.set).mockImplementation(async (key, value) => {
    store.set(key, value);
    return { ok: true } as never;
  });
});

describe("withCachedDashboardDecision", () => {
  test("decides once, then answers the same principal from the cache for 30 seconds", async () => {
    const decide = vi.fn(async () => ACCESS);

    expect(await withCachedDashboardDecision(parts, decide)).toEqual(ACCESS);
    expect(await withCachedDashboardDecision(parts, decide)).toEqual(ACCESS);

    expect(decide).toHaveBeenCalledTimes(1);
    expect(DASHBOARD_READ_DECISION_TTL_MS).toBe(30_000);
    expect(vi.mocked(cache.set).mock.calls[0][2]).toBe(DASHBOARD_READ_DECISION_TTL_MS);
  });

  test("never caches a refusal", async () => {
    const decide = vi.fn(async () => new Response(null, { status: 403 }));

    expect(((await withCachedDashboardDecision(parts, decide)) as Response).status).toBe(403);
    expect(((await withCachedDashboardDecision(parts, decide)) as Response).status).toBe(403);
    expect(decide).toHaveBeenCalledTimes(2);
    expect(cache.set).not.toHaveBeenCalled();
  });

  test("asks again for another principal, another decision, or once the dashboard is saved", async () => {
    const decide = vi.fn(async () => ACCESS);
    await withCachedDashboardDecision(parts, decide);

    await withCachedDashboardDecision({ ...parts, principal: "user_2" }, decide);
    await withCachedDashboardDecision({ ...parts, decision: "dataset:clds1" }, decide);
    await withCachedDashboardDecision(
      { ...parts, dashboard: { ...parts.dashboard, updatedAt: new Date("2026-11-03T00:00:00Z") } },
      decide
    );

    expect(decide).toHaveBeenCalledTimes(4);
  });

  test("without a principal, or with the cache down, it decides every time", async () => {
    const decide = vi.fn(async () => ACCESS);
    await withCachedDashboardDecision({ ...parts, principal: null }, decide);
    await withCachedDashboardDecision({ ...parts, principal: null }, decide);
    expect(cache.get).not.toHaveBeenCalled();

    vi.mocked(cache.get).mockResolvedValue({ ok: false, error: new Error("down") } as never);
    await withCachedDashboardDecision(parts, decide);
    expect(decide).toHaveBeenCalledTimes(3);
  });
});
