import type { DBAdapter } from "@better-auth/core/db/adapter";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  readConsentPreimages,
  readOwnConsentWriteCheck,
  recordOAuthConsentWrites,
} from "./oauth-consent-writes";

const state = vi.hoisted(() => ({ active: true, values: new Map<object, unknown>() }));

// Better Auth's per-request state, as a map the test clears between requests.
vi.mock("@better-auth/core/context", () => ({
  defineRequestState: (init: () => unknown) => {
    const ref = {};
    return {
      get: async () => (state.values.has(ref) ? state.values.get(ref) : init()),
      set: async (value: unknown) => void state.values.set(ref, value),
    };
  },
  hasRequestState: async () => state.active,
}));

const STAMP = new Date("2026-11-17T10:00:00.000Z");

const row = (id: string, updatedAt = STAMP) => ({ id, userId: "user-1", clientId: "client-1", updatedAt });

const inner = {
  id: "prisma",
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...row("consent-1"), ...data })),
  update: vi.fn(async () => row("consent-1")),
  findOne: vi.fn(async () => row("consent-1")),
};

const adapter = recordOAuthConsentWrites(() => inner as unknown as DBAdapter)({});

beforeEach(() => {
  state.active = true;
  state.values.clear();
  vi.clearAllMocks();
});

describe("recordOAuthConsentWrites", () => {
  test("passes every call through and returns what the adapter returned", async () => {
    const created = await adapter.create({ model: "oauthConsent", data: { scopes: ["openid"] } });
    const updated = await adapter.update({ model: "user", where: [{ field: "id", value: "u" }], update: {} });
    const found = await adapter.findOne({ model: "oauthConsent", where: [] });

    expect(created).toEqual({ ...row("consent-1"), scopes: ["openid"] });
    expect(updated).toEqual(row("consent-1"));
    expect(found).toEqual(row("consent-1"));
    expect(inner.create).toHaveBeenCalledWith({ model: "oauthConsent", data: { scopes: ["openid"] } });
    expect(adapter.id).toBe("prisma");
  });

  test("names the consent rows this request created or updated, as their writes stamped them", async () => {
    await adapter.create({ model: "oauthConsent", data: {} });
    inner.update.mockResolvedValueOnce(row("consent-2"));
    await adapter.update({ model: "oauthConsent", where: [{ field: "id", value: "consent-2" }], update: {} });

    const isOwnWrite = await readOwnConsentWriteCheck();
    expect(isOwnWrite(row("consent-1"))).toBe(true);
    expect(isOwnWrite(row("consent-2"))).toBe(true);
  });

  // A second tab approving the same client rewrites this row a second later: that write is not this one.
  test("doesn't name a row another write stamped since, nor a row it never wrote", async () => {
    await adapter.create({ model: "oauthConsent", data: {} });

    const isOwnWrite = await readOwnConsentWriteCheck();
    expect(isOwnWrite(row("consent-1", new Date(STAMP.getTime() + 1_000)))).toBe(false);
    expect(isOwnWrite(row("consent-9"))).toBe(false);
  });

  test("records no write of another model, nor an update that matched no row", async () => {
    await adapter.create({ model: "session", data: {} });
    inner.update.mockResolvedValueOnce(null as never);
    await adapter.update({ model: "oauthConsent", where: [{ field: "id", value: "gone" }], update: {} });

    expect((await readOwnConsentWriteCheck())(row("consent-1"))).toBe(false);
  });

  // What the update replaced, read just before it: another tab's approval saved since the request began.
  test("records what an update replaced, read right before it, and no preimage for a create", async () => {
    const before = {
      ...row("consent-2", new Date("2026-11-17T09:59:00.000Z")),
      scopes: ["openid", "surveys:read"],
      resources: ["https://app/api/mcp"],
      requestedUserInfoClaims: [],
    };
    // A stateful store: the update displaces `before`, and a read after it would see the new row.
    let stored: Record<string, unknown> = before;
    inner.findOne.mockImplementation(async () => stored as never);
    inner.update.mockImplementationOnce(async () => {
      stored = row("consent-2");
      return stored as never;
    });

    await adapter.update({ model: "oauthConsent", where: [{ field: "id", value: "consent-2" }], update: {} });
    await adapter.create({ model: "oauthConsent", data: {} });

    const { replaced, createdIds } = await readConsentPreimages();
    expect(replaced).toEqual([
      {
        id: "consent-2",
        scopes: ["openid", "surveys:read"],
        resources: ["https://app/api/mcp"],
        requestedUserInfoClaims: [],
        updatedAt: before.updatedAt,
      },
    ]);
    expect([...createdIds]).toEqual(["consent-1"]);
  });

  test("reads no preimage for another model's update", async () => {
    await adapter.update({ model: "user", where: [{ field: "id", value: "u" }], update: {} });

    expect(inner.findOne).not.toHaveBeenCalled();
  });

  test("records nothing, and names nothing, outside a request", async () => {
    state.active = false;
    await adapter.create({ model: "oauthConsent", data: {} });
    expect((await readOwnConsentWriteCheck())(row("consent-1"))).toBe(false);

    state.active = true;
    expect((await readOwnConsentWriteCheck())(row("consent-1"))).toBe(false);
  });
});
