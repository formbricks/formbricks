import { APIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  REVOCATION_CLOCK_SKEW_MS,
  markOAuthRevocation,
  readExchangedAuthorizationCode,
  readOAuthRevocationTime,
  refuseCodeIssuedBeforeRevocationBeforeHandler,
} from "./oauth-revocation-marker";

const storage = vi.hoisted(() => new Map<string, { value: string; ttl?: number }>());
vi.mock("./secondary-storage", () => ({
  redisSecondaryStorage: {
    get: vi.fn(async (key: string) => storage.get(key)?.value ?? null),
    set: vi.fn(async (key: string, value: string, ttl?: number) => {
      storage.set(key, { value, ttl });
    }),
    // The Lua script's contract: the stored number never goes down, and the TTL is refreshed either way.
    setMax: vi.fn(async (key: string, value: number, ttl: number) => {
      const stored = Number(storage.get(key)?.value);
      const next = Number.isFinite(stored) && stored >= value ? stored : value;
      storage.set(key, { value: String(next), ttl });
    }),
  },
}));

// The request state Better Auth provides per request; here a plain map, so the hooks can record the
// exchanged code as they do in production.
const requestState = vi.hoisted(() => new Map<object, unknown>());
vi.mock("@better-auth/core/context", () => ({
  defineRequestState: (init: () => unknown) => {
    const ref = {};
    return {
      get: async () => (requestState.has(ref) ? requestState.get(ref) : init()),
      set: async (value: unknown) => void requestState.set(ref, value),
    };
  },
  hasRequestState: () => true,
}));

const CODE = "the-code";
const ISSUED_AT = new Date("2026-11-16T10:00:00.000Z");

type TCtx = Parameters<typeof refuseCodeIssuedBeforeRevocationBeforeHandler>[0];
const findVerificationValue = vi.fn();
const ctx = (body: unknown, path = "/oauth2/token"): TCtx =>
  ({ path, body, context: { internalAdapter: { findVerificationValue } } }) as unknown as TCtx;
const exchange = (code: unknown = CODE) => ctx({ grant_type: "authorization_code", code });

const codeRecord = (value: unknown, createdAt = ISSUED_AT) => ({
  value: typeof value === "string" ? value : JSON.stringify(value),
  createdAt,
});
const OWNED = { type: "authorization_code", userId: "user-1", query: { client_id: "client-1" } };

const setRevokedAt = (key: string, at: Date) => storage.set(key, { value: String(at.getTime()) });

beforeEach(() => {
  storage.clear();
  requestState.clear();
  findVerificationValue.mockReset().mockResolvedValue(codeRecord(OWNED));
});

describe("markOAuthRevocation", () => {
  test("marks the user's codes for one client, or for every client, for as long as a code lives", async () => {
    vi.useFakeTimers({ now: ISSUED_AT });
    await markOAuthRevocation({ userId: "user-1", clientId: "client-1" });
    await markOAuthRevocation({ userId: "user-2" });
    vi.useRealTimers();

    expect(storage.get("oauth-revoked:user-1:client-1")).toEqual({
      value: String(ISSUED_AT.getTime()),
      ttl: 660,
    });
    expect(storage.get("oauth-revoked:user-2")).toEqual({ value: String(ISSUED_AT.getTime()), ttl: 660 });
  });

  // Two revocations can finish out of order (the later one marks first, the earlier one's write lands
  // second). The mark must keep the later time, or a code issued between them would pass the check.
  test("never moves a mark back, and refreshes its TTL anyway", async () => {
    vi.useFakeTimers({ now: ISSUED_AT });
    await markOAuthRevocation({ userId: "user-1", clientId: "client-1" });
    vi.setSystemTime(new Date(ISSUED_AT.getTime() - 5_000));
    await markOAuthRevocation({ userId: "user-1", clientId: "client-1" });
    vi.useRealTimers();

    expect(storage.get("oauth-revoked:user-1:client-1")).toEqual({
      value: String(ISSUED_AT.getTime()),
      ttl: 660,
    });
  });
});

describe("readOAuthRevocationTime", () => {
  test("is the later of the user's and the client's marks, and null without one", async () => {
    expect(await readOAuthRevocationTime("user-1", "client-1")).toBeNull();
    setRevokedAt("oauth-revoked:user-1", new Date(1_000));
    setRevokedAt("oauth-revoked:user-1:client-1", new Date(2_000));
    expect(await readOAuthRevocationTime("user-1", "client-1")).toBe(2_000);
    expect(await readOAuthRevocationTime("user-1", "client-2")).toBe(1_000);
  });
});

describe("refuseCodeIssuedBeforeRevocationBeforeHandler", () => {
  test("looks the code up by the provider's stored hash, without consuming it", async () => {
    await refuseCodeIssuedBeforeRevocationBeforeHandler(exchange());

    expect(findVerificationValue).toHaveBeenCalledWith(createHash("sha256").update(CODE).digest("base64url"));
  });

  // The grant claim re-checks the mark with the code's issue time, so a Revoke between this read and
  // the code's exchange still leaves the connection without a grant.
  test("records the code it accepts, with its issue time, for the grant claim", async () => {
    await refuseCodeIssuedBeforeRevocationBeforeHandler(exchange());

    expect(await readExchangedAuthorizationCode()).toEqual({
      userId: "user-1",
      clientId: "client-1",
      issuedAt: ISSUED_AT.getTime(),
    });
  });

  test.each([
    ["issued before the client's Revoke", "oauth-revoked:user-1:client-1", 1_000],
    ["issued in the second of the user's bulk end", "oauth-revoked:user-1", 0],
    // The revoking pod's clock may run behind the issuing pod's.
    [
      "issued within the clock skew after the Revoke",
      "oauth-revoked:user-1:client-1",
      -REVOCATION_CLOCK_SKEW_MS,
    ],
  ])("refuses a code %s", async (_case, key, revokedAfterMs) => {
    setRevokedAt(key, new Date(ISSUED_AT.getTime() + revokedAfterMs));

    const thrown = await refuseCodeIssuedBeforeRevocationBeforeHandler(exchange()).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(APIError);
    expect((thrown as APIError).body).toMatchObject({ error: "invalid_grant" });
  });

  test("lets a code issued after the revocation and its clock skew through, and one of another client", async () => {
    setRevokedAt(
      "oauth-revoked:user-1:client-1",
      new Date(ISSUED_AT.getTime() - REVOCATION_CLOCK_SKEW_MS - 1)
    );
    setRevokedAt("oauth-revoked:user-1:client-2", new Date(ISSUED_AT.getTime() + 1_000));

    await expect(refuseCodeIssuedBeforeRevocationBeforeHandler(exchange())).resolves.toBeUndefined();
  });

  test.each([
    ["another path", ctx({ grant_type: "authorization_code", code: CODE }, "/oauth2/consent")],
    ["a refresh", ctx({ grant_type: "refresh_token", refresh_token: "r" })],
    ["no code", exchange("")],
  ])("reads nothing for %s", async (_case, hookCtx) => {
    await refuseCodeIssuedBeforeRevocationBeforeHandler(hookCtx);

    expect(findVerificationValue).not.toHaveBeenCalled();
  });

  test.each([
    ["an unknown code", null],
    ["a record that isn't JSON", codeRecord("not json")],
    ["a record without a client", codeRecord({ userId: "user-1", query: {} })],
  ])("leaves %s to the provider", async (_case, record) => {
    findVerificationValue.mockResolvedValue(record);
    setRevokedAt("oauth-revoked:user-1", new Date(ISSUED_AT.getTime() + 1_000));

    await expect(refuseCodeIssuedBeforeRevocationBeforeHandler(exchange())).resolves.toBeUndefined();
  });
});
