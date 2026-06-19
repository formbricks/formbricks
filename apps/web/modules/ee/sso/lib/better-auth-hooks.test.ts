import { getOAuthState } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getSsoProviderFromContext, ssoDatabaseHooks } from "./better-auth-hooks";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "./sso-provisioning";
import {
  getSsoProvisioningDecision,
  runWithSsoRequestContext,
  setSsoProvisioningDecision,
} from "./sso-request-context";

vi.mock("better-auth/api", () => ({ getOAuthState: vi.fn() }));
vi.mock("@/lib/utils/locale", () => ({ findMatchingLocale: vi.fn() }));
vi.mock("./sso-provisioning", () => ({
  gateSsoProvisioning: vi.fn(),
  provisionSsoUserMemberships: vi.fn(),
}));

const callbackCtx = { path: "/oauth2/callback/:providerId", params: { providerId: "openid" } };
const provisionDecision = {
  action: "provision" as const,
  organizationId: "org-1",
  assignToDefaultTeam: false,
  signupSource: "direct" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
  vi.mocked(getOAuthState).mockResolvedValue({ callbackURL: "/" } as never);
  vi.mocked(gateSsoProvisioning).mockResolvedValue(provisionDecision);
});

describe("getSsoProviderFromContext", () => {
  test("reads the provider from a generic-OAuth callback's params", () => {
    expect(
      getSsoProviderFromContext({ path: "/oauth2/callback/:providerId", params: { providerId: "openid" } })
    ).toBe("openid");
  });

  test("reads the provider from a built-in social callback's params", () => {
    expect(getSsoProviderFromContext({ path: "/callback/:id", params: { id: "google" } })).toBe("google");
  });

  test("falls back to parsing a resolved callback path", () => {
    expect(getSsoProviderFromContext({ path: "/oauth2/callback/azuread", params: {} })).toBe("azuread");
  });

  test.each([{ path: "/sign-up/email" }, { path: "/sign-in/email" }, {}, null, undefined])(
    "returns null for non-callback context %j",
    (ctx) => {
      expect(getSsoProviderFromContext(ctx as never)).toBeNull();
    }
  );
});

describe("ssoDatabaseHooks.user.create.before", () => {
  const before = ssoDatabaseHooks.user!.create!.before!;

  test("rejects (returns false) when the provisioning gate rejects", async () => {
    vi.mocked(gateSsoProvisioning).mockResolvedValue({ action: "reject", reason: "missing_callback_url" });
    const result = await runWithSsoRequestContext(() =>
      before({ id: "u1", email: "a@b.com" } as never, callbackCtx as never)
    );
    expect(result).toBe(false);
    expect(getSsoProvisioningDecision()).toBeUndefined();
  });

  test("on provision: verifies email, denormalizes provider, sets locale + name fallback, and stashes the decision", async () => {
    let stashed: ReturnType<typeof getSsoProvisioningDecision>;
    const result = await runWithSsoRequestContext(async () => {
      const r = await before({ id: "u1", email: "john.doe@example.com" } as never, callbackCtx as never);
      stashed = getSsoProvisioningDecision();
      return r;
    });
    expect(result).toEqual({
      data: { emailVerified: true, identityProvider: "openid", locale: "en-US", name: "john doe" },
    });
    expect(stashed).toEqual(provisionDecision);
    expect(gateSsoProvisioning).toHaveBeenCalledWith({ email: "john.doe@example.com", callbackUrl: "/" });
  });

  test("keeps the provider-supplied name (no fallback) when present", async () => {
    const result = await runWithSsoRequestContext(() =>
      before({ id: "u1", email: "a@b.com", name: "Ada Lovelace" } as never, callbackCtx as never)
    );
    expect(result).toEqual({ data: { emailVerified: true, identityProvider: "openid", locale: "en-US" } });
  });

  test("leaves email/password sign-ups untouched (gate not run)", async () => {
    const result = await before({ id: "u1", email: "a@b.com" } as never, { path: "/sign-up/email" } as never);
    expect(result).toBeUndefined();
    expect(gateSsoProvisioning).not.toHaveBeenCalled();
  });
});

describe("ssoDatabaseHooks.user.create.after", () => {
  const after = ssoDatabaseHooks.user!.create!.after!;
  const before = ssoDatabaseHooks.user!.create!.before!;

  test("provisions memberships from the stashed decision", async () => {
    await runWithSsoRequestContext(async () => {
      setSsoProvisioningDecision(provisionDecision);
      await after({ id: "u1", email: "a@b.com" } as never, callbackCtx as never);
    });
    expect(provisionSsoUserMemberships).toHaveBeenCalledWith({
      userId: "u1",
      email: "a@b.com",
      provider: "openid",
      organizationId: "org-1",
      assignToDefaultTeam: false,
      signupSource: "direct",
    });
  });

  test("does nothing when no decision is stashed (e.g. non-SSO sign-up)", async () => {
    await runWithSsoRequestContext(() =>
      after({ id: "u1", email: "a@b.com" } as never, callbackCtx as never)
    );
    expect(provisionSsoUserMemberships).not.toHaveBeenCalled();
  });

  test("before → after carries the decision end-to-end", async () => {
    await runWithSsoRequestContext(async () => {
      await before({ id: "u1", email: "a@b.com" } as never, callbackCtx as never);
      await after({ id: "u1", email: "a@b.com" } as never, callbackCtx as never);
    });
    expect(provisionSsoUserMemberships).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", organizationId: "org-1", provider: "openid" })
    );
  });
});

describe("ssoDatabaseHooks.account.create.after", () => {
  const after = ssoDatabaseHooks.account!.create!.after!;
  const ctxWith = (updateUser: unknown) => ({ context: { internalAdapter: { updateUser } } });

  test("denormalizes provider + accountId onto the user for SSO accounts", async () => {
    const updateUser = vi.fn().mockResolvedValue(undefined);
    await after(
      { userId: "u1", providerId: "azuread", accountId: "sub-123" } as never,
      ctxWith(updateUser) as never
    );
    expect(updateUser).toHaveBeenCalledWith("u1", {
      identityProvider: "azuread",
      identityProviderAccountId: "sub-123",
    });
  });

  test("skips credential (email/password) accounts", async () => {
    const updateUser = vi.fn();
    await after(
      { userId: "u1", providerId: "credential", accountId: "x" } as never,
      ctxWith(updateUser) as never
    );
    expect(updateUser).not.toHaveBeenCalled();
  });
});
