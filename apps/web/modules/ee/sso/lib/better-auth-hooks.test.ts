import { getOAuthState } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { identifyPostHogPerson } from "@/lib/posthog";
import { findMatchingLocale } from "@/lib/utils/locale";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import { isSignupDomainAllowed } from "@/modules/auth/lib/signup-request-context";
import { getIsSamlSsoEnabled, getIsSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  blockedSignupDomainRedirectAfter,
  getSsoProviderFromContext,
  ssoDatabaseHooks,
  ssoLicenseGateBefore,
  ssoRecoveryAfter,
} from "./better-auth-hooks";
import { gateSsoProvisioning, provisionSsoUserMemberships } from "./sso-provisioning";
import { startSsoRecovery } from "./sso-recovery";
import {
  captureSsoIdentity,
  getSsoProvisioningDecision,
  getSsoSignupRejectReason,
  runWithSsoRequestContext,
  setSsoProvisioningDecision,
  setSsoSignupRejectReason,
} from "./sso-request-context";

vi.mock("better-auth/api", () => ({
  getOAuthState: vi.fn(),
  // Passthrough so the wrapped hook is testable directly as its inner function.
  createAuthMiddleware: (fn: unknown) => fn,
  APIError: class APIError extends Error {
    status: string;
    constructor(status: string, body?: { message?: string }) {
      super(body?.message);
      this.status = status;
    }
  },
}));
vi.mock("@formbricks/database", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/posthog", () => ({ identifyPostHogPerson: vi.fn() }));
vi.mock("@/lib/utils/locale", () => ({ findMatchingLocale: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSsoEnabled: vi.fn(),
  getIsSamlSsoEnabled: vi.fn(),
}));
vi.mock("./sso-provisioning", () => ({
  gateSsoProvisioning: vi.fn(),
  provisionSsoUserMemberships: vi.fn(),
}));
vi.mock("./sso-recovery", () => ({ startSsoRecovery: vi.fn() }));
vi.mock("@/modules/auth/lib/signup-email-domain", () => ({ isSignupEmailDomainBlocked: vi.fn() }));
vi.mock("@/modules/auth/lib/signup-request-context", () => ({ isSignupDomainAllowed: vi.fn() }));

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
  vi.mocked(getIsSsoEnabled).mockResolvedValue(true);
  vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    locale: "en-US",
  } as never);
  vi.mocked(startSsoRecovery).mockResolvedValue("/auth/verification-requested?x=1");
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

  test("stashes the reject reason so the after-hook can redirect (personal email domain)", async () => {
    vi.mocked(gateSsoProvisioning).mockResolvedValue({
      action: "reject",
      reason: SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
    });
    let reason: string | undefined;
    const result = await runWithSsoRequestContext(async () => {
      const r = await before({ id: "u1", email: "spammer@gmail.com" } as never, callbackCtx as never);
      reason = getSsoSignupRejectReason();
      return r;
    });
    expect(result).toBe(false);
    expect(reason).toBe(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
  });

  test("fails loud when the request context is missing (route not wrapped in runWithSsoRequestContext)", async () => {
    // Without the wrapper a provision decision can't be stashed; fail rather than silently create a
    // user with no organization membership.
    await expect(before({ id: "u1", email: "a@b.com" } as never, callbackCtx as never)).rejects.toThrow(
      "SSO request context is missing"
    );
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
    // image is present-as-undefined so Better Auth's transformInput drops it (no User.image column).
    expect(result).toHaveProperty("data.image", undefined);
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

  test("blocks a credential sign-up that bypassed the action (raw /sign-up/email) with a blocked domain", async () => {
    vi.mocked(isSignupDomainAllowed).mockReturnValue(false); // no action mark → direct native-endpoint POST
    vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(true);
    const result = await before(
      { id: "u1", email: "spammer@gmail.com" } as never,
      {
        path: "/sign-up/email",
      } as never
    );
    expect(result).toBe(false);
    expect(gateSsoProvisioning).not.toHaveBeenCalled();
  });

  test("allows a credential sign-up that went through the action (domain already enforced, hook skips)", async () => {
    vi.mocked(isSignupDomainAllowed).mockReturnValue(true); // action marked the scope
    vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(true); // would block, but must be skipped
    const result = await before(
      { id: "u1", email: "spammer@gmail.com" } as never,
      {
        path: "/sign-up/email",
      } as never
    );
    expect(result).toBeUndefined();
    expect(isSignupEmailDomainBlocked).not.toHaveBeenCalled();
  });

  test("allows a credential sign-up with an allowed domain on the raw endpoint", async () => {
    vi.mocked(isSignupDomainAllowed).mockReturnValue(false);
    vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(false);
    const result = await before(
      { id: "u1", email: "person@acme-corp.com" } as never,
      {
        path: "/sign-up/email",
      } as never
    );
    expect(result).toBeUndefined();
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
      attributionProperties: {},
    });
    expect(identifyPostHogPerson).toHaveBeenCalledWith("u1", { email: "a@b.com", name: undefined });
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

describe("ssoLicenseGateBefore", () => {
  const samlCtx = { path: "/oauth2/callback/:providerId", params: { providerId: "saml" } };

  test("ignores non-callback requests without checking the license", async () => {
    await ssoLicenseGateBefore({ path: "/sign-up/email" } as never);
    expect(getIsSsoEnabled).not.toHaveBeenCalled();
  });

  test("allows an SSO callback when SSO is licensed", async () => {
    await expect(ssoLicenseGateBefore(callbackCtx as never)).resolves.toBeUndefined();
    expect(getIsSsoEnabled).toHaveBeenCalled();
  });

  test("blocks an SSO callback when SSO is not licensed", async () => {
    vi.mocked(getIsSsoEnabled).mockResolvedValue(false);
    await expect(ssoLicenseGateBefore(callbackCtx as never)).rejects.toThrow("SSO is not enabled");
  });

  test("blocks a SAML callback when SAML is not licensed (even if SSO is)", async () => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);
    await expect(ssoLicenseGateBefore(samlCtx as never)).rejects.toThrow("SAML SSO is not enabled");
  });

  test("allows a SAML callback when both SSO and SAML are licensed", async () => {
    await expect(ssoLicenseGateBefore(samlCtx as never)).resolves.toBeUndefined();
  });
});

describe("ssoRecoveryAfter", () => {
  const collisionLocation = "https://app.test/error?error=account_not_linked";
  const makeCtx = (overrides: Record<string, unknown> = {}) => ({
    path: "/oauth2/callback/:providerId",
    params: { providerId: "openid" },
    context: { responseHeaders: new Headers({ location: collisionLocation }) },
    redirect: vi.fn((url: string) => new Error(`redirect:${url}`)),
    ...overrides,
  });

  test("starts recovery and redirects on a collision with a captured identity + existing user", async () => {
    const redirect = vi.fn((url: string) => new Error(`redirect:${url}`));
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "a@b.com", providerAccountId: "sub-1" });
      await expect(ssoRecoveryAfter(ctx as never)).rejects.toBeDefined(); // throws ctx.redirect(...)
    });
    expect(startSsoRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openid",
        account: expect.objectContaining({ providerAccountId: "sub-1" }),
      })
    );
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("/auth/verification-requested"));
  });

  test("ignores callbacks that did not collide", async () => {
    const ctx = makeCtx({ context: { responseHeaders: new Headers({ location: "https://app.test/ok" }) } });
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "a@b.com", providerAccountId: "sub-1" });
      await ssoRecoveryAfter(ctx as never);
    });
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("ignores collisions with no captured identity", async () => {
    const ctx = makeCtx();
    await runWithSsoRequestContext(() => ssoRecoveryAfter(ctx as never));
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("ignores collisions with no matching existing user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const ctx = makeCtx();
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "ghost@b.com", providerAccountId: "sub-1" });
      await ssoRecoveryAfter(ctx as never);
    });
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("ignores non-SSO callbacks", async () => {
    const ctx = makeCtx({ path: "/sign-up/email", params: {} });
    await ssoRecoveryAfter(ctx as never);
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("ignores callbacks with no response-redirect headers", async () => {
    const ctx = makeCtx({ context: {} });
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "a@b.com", providerAccountId: "sub-1" });
      await ssoRecoveryAfter(ctx as never);
    });
    expect(startSsoRecovery).not.toHaveBeenCalled();
  });

  test("still recovers (empty callbackUrl) when the OAuth state is unavailable", async () => {
    vi.mocked(getOAuthState).mockRejectedValue(new Error("no state"));
    const redirect = vi.fn((url: string) => new Error(`redirect:${url}`));
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(async () => {
      captureSsoIdentity({ email: "a@b.com", providerAccountId: "sub-1" });
      await expect(ssoRecoveryAfter(ctx as never)).rejects.toBeDefined();
    });
    expect(startSsoRecovery).toHaveBeenCalledWith(expect.objectContaining({ callbackUrl: "" }));
    expect(redirect).toHaveBeenCalled();
  });
});

describe("blockedSignupDomainRedirectAfter", () => {
  const makeCtx = (overrides: Record<string, unknown> = {}) => ({
    path: "/oauth2/callback/:providerId",
    params: { providerId: "openid" },
    context: {
      responseHeaders: new Headers({ location: "https://app.test/auth/login?error=unable_to_create_user" }),
    },
    redirect: vi.fn((url: string) => new Error(`redirect:${url}`)),
    ...overrides,
  });

  test("rewrites the redirect to /auth/signup when a personal-email rejection was stashed", async () => {
    const redirect = vi.fn((url: string) => new Error(`redirect:${url}`));
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(async () => {
      setSsoSignupRejectReason(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
      await expect(blockedSignupDomainRedirectAfter(ctx as never)).rejects.toBeDefined(); // throws ctx.redirect
    });
    expect(redirect).toHaveBeenCalledWith(
      expect.stringContaining(`/auth/signup?error=${SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE}`)
    );
  });

  test("does nothing when no personal-email rejection was stashed", async () => {
    const redirect = vi.fn();
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(() => blockedSignupDomainRedirectAfter(ctx as never));
    expect(redirect).not.toHaveBeenCalled();
  });

  test("does nothing for a different (non-domain) reject reason", async () => {
    const redirect = vi.fn();
    const ctx = makeCtx({ redirect });
    await runWithSsoRequestContext(async () => {
      setSsoSignupRejectReason("missing_callback_url");
      await blockedSignupDomainRedirectAfter(ctx as never);
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  test("does nothing when Better Auth set no redirect location", async () => {
    const redirect = vi.fn();
    const ctx = makeCtx({ redirect, context: {} });
    await runWithSsoRequestContext(async () => {
      setSsoSignupRejectReason(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
      await blockedSignupDomainRedirectAfter(ctx as never);
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
