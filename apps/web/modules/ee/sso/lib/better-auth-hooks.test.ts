import { getOAuthState } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { SIGNUP_DISABLED_ERROR_CODE, SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { getIsFreshInstance } from "@/lib/instance/service";
import { identifyPostHogPerson } from "@/lib/posthog";
import { findMatchingLocale } from "@/lib/utils/locale";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import { isSignupDomainAllowed } from "@/modules/auth/lib/signup-request-context";
import {
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
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
  // Keeps `body` like the real APIError does, so a test can assert the stable error CODE rather than
  // the English message — dropping it would leave the message as the only assertable thing, which is
  // display copy, not the contract callers depend on.
  APIError: class APIError extends Error {
    status: string;
    body?: { message?: string; code?: string };
    constructor(status: string, body?: { message?: string; code?: string }) {
      super(body?.message);
      this.status = status;
      this.body = body;
    }
  },
}));
vi.mock("@formbricks/database", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/posthog", () => ({ identifyPostHogPerson: vi.fn() }));
vi.mock("@/lib/utils/locale", () => ({ findMatchingLocale: vi.fn() }));
vi.mock("./sso-provisioning", () => ({
  gateSsoProvisioning: vi.fn(),
  provisionSsoUserMemberships: vi.fn(),
}));
vi.mock("./sso-recovery", () => ({ startSsoRecovery: vi.fn() }));
vi.mock("@/modules/auth/lib/signup-email-domain", () => ({ isSignupEmailDomainBlocked: vi.fn() }));
vi.mock("@/modules/auth/lib/signup-request-context", () => ({ isSignupDomainAllowed: vi.fn() }));

const constantsOverrides = vi.hoisted(() => ({ SIGNUP_ENABLED: true }));
vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "http://localhost:3000",
  get SIGNUP_ENABLED() {
    return constantsOverrides.SIGNUP_ENABLED;
  },
}));
vi.mock("@/lib/instance/service", () => ({ getIsFreshInstance: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
  getIsSsoEnabled: vi.fn(),
  getIsSamlSsoEnabled: vi.fn(),
}));

// Better Auth's INTERNAL endpoint path, which 1.7 serves at `/callback/:id`. Not the public SSO callback
// URL — that stays `/api/auth/oauth2/callback/{providerId}`, pinned (ENG-2343) and mapped onto this one.
const callbackCtx = { path: "/callback/:providerId", params: { providerId: "openid" } };
const provisionDecision = {
  action: "provision" as const,
  organizationId: "org-1",
  assignToDefaultTeam: false,
  signupSource: "direct" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  constantsOverrides.SIGNUP_ENABLED = true;
  vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
  vi.mocked(getOAuthState).mockResolvedValue({ callbackURL: "/" } as never);
  vi.mocked(gateSsoProvisioning).mockResolvedValue(provisionDecision);
  vi.mocked(getIsSsoEnabled).mockResolvedValue(true);
  vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
  vi.mocked(getIsFreshInstance).mockResolvedValue(false);
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
      getSsoProviderFromContext({ path: "/callback/:providerId", params: { providerId: "openid" } })
    ).toBe("openid");
  });

  test("reads the provider from a built-in social callback's params", () => {
    expect(getSsoProviderFromContext({ path: "/callback/:id", params: { id: "google" } })).toBe("google");
  });

  test("falls back to parsing a resolved callback path", () => {
    expect(getSsoProviderFromContext({ path: "/callback/azuread", params: {} })).toBe("azuread");
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
      // `emailVerified: true` is what the openid mapper resolves for an IdP that omits the claim — the
      // common path — so this stays a test about the other four enrichment fields.
      const r = await before(
        { id: "u1", email: "john.doe@example.com", emailVerified: true } as never,
        callbackCtx as never
      );
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

  test("normalizes a clean provider-supplied name (unchanged, no fallback) when present", async () => {
    const result = await runWithSsoRequestContext(() =>
      before(
        { id: "u1", email: "a@b.com", name: "Ada Lovelace", emailVerified: true } as never,
        callbackCtx as never
      )
    );
    expect(result).toEqual({
      data: { emailVerified: true, identityProvider: "openid", locale: "en-US", name: "Ada Lovelace" },
    });
  });

  // ENG-1743: an IdP display name with common punctuation must never fail the sign-in. The provider
  // name is normalized to a ZUserName-valid form (allowlisted punctuation preserved, the rest collapsed
  // to a single space), so no `ValidationError: Invalid name format` is thrown from the SSO create path.
  test.each([
    { name: "J. Smith", expected: "J. Smith" }, // period preserved
    { name: "Smith & Co", expected: "Smith & Co" }, // ampersand preserved
    { name: "Ada  O'Neil", expected: "Ada O'Neil" }, // apostrophe kept, double space collapsed
    { name: "A/B Corp", expected: "A B Corp" }, // slash (not allowlisted) collapsed to space
    { name: "José 🎉 Núñez", expected: "José Núñez" }, // emoji stripped, accented letters kept
  ])("normalizes a punctuated provider name '$name' → '$expected'", async ({ name, expected }) => {
    const result = await runWithSsoRequestContext(() =>
      before({ id: "u1", email: "a@b.com", name } as never, callbackCtx as never)
    );
    expect(result).toMatchObject({ data: { name: expected } });
  });

  test("falls back to the email local-part when the provider name normalizes to empty", async () => {
    const result = await runWithSsoRequestContext(() =>
      before({ id: "u1", email: "jane.doe@example.com", name: "🎉🎉" } as never, callbackCtx as never)
    );
    expect(result).toMatchObject({ data: { name: "jane doe" } });
  });

  // ENG-1743 edge: if BOTH the provider name and the email local-part normalize to empty (a degenerate
  // service/machine account), fall back to a constant so the stored name is a valid non-empty
  // ZUserName — otherwise "" would pass Better Auth's create but throw on the user's first profile save.
  test("falls back to a constant when the provider name and email local-part both normalize to empty", async () => {
    const result = await runWithSsoRequestContext(() =>
      before({ id: "u1", email: "🎉@example.com", name: "🎉🎉" } as never, callbackCtx as never)
    );
    expect(result).toMatchObject({ data: { name: "User" } });
  });

  // ENG-2589: Better Auth computes the IdP's own `emailVerified` answer BEFORE this hook runs —
  // google reads `email_verified` from the id_token, github from /user/emails — and hands it to the
  // hook as `user.emailVerified`; whatever the hook returns is shallow-merged over it. Overwriting
  // with `true` mints a verified account for an address the IdP itself calls unproven (account
  // squatting: `reclaimUnverifiedLocalAuthIfNeeded` skips verified users, and an org invite to that
  // address lands on the squatter's account).
  describe("emailVerified follows the IdP's claim where it is a real signal (ENG-2589)", () => {
    const socialCtx = (id: string) => ({ path: "/callback/:id", params: { id } });

    test.each(["google", "github"])("%s: an IdP-unverified email is not marked verified", async (id) => {
      const result = await runWithSsoRequestContext(() =>
        before({ id: "u1", email: "a@b.com", emailVerified: false } as never, socialCtx(id) as never)
      );
      expect(result).toMatchObject({ data: { emailVerified: false } });
    });

    test.each(["google", "github"])("%s: an IdP-verified email stays verified", async (id) => {
      const result = await runWithSsoRequestContext(() =>
        before({ id: "u1", email: "a@b.com", emailVerified: true } as never, socialCtx(id) as never)
      );
      expect(result).toMatchObject({ data: { emailVerified: true } });
    });

    // The generic providers are `raw-claim`: their mapProfileToUser has already resolved the raw
    // `email_verified` (absent → true, asserted false → false) and that value reaches the hook as
    // `user.emailVerified`, so the hook passes it through rather than deciding again. Asserting the
    // pass-through here is what stops a future edit re-introducing a blanket `true` that would
    // silently discard the mapper's answer — the claim-reading itself is covered in
    // better-auth-providers.test.ts and end to end in better-auth-oidc-email-verified.test.ts.
    test.each(["openid", "azuread"])("%s: passes the mapper-resolved claim through", async (id) => {
      const genericCtx = { path: "/callback/:providerId", params: { providerId: id } };
      const denied = await runWithSsoRequestContext(() =>
        before({ id: "u1", email: "a@b.com", emailVerified: false } as never, genericCtx as never)
      );
      expect(denied).toMatchObject({ data: { emailVerified: false } });

      const attested = await runWithSsoRequestContext(() =>
        before({ id: "u1", email: "a@b.com", emailVerified: true } as never, genericCtx as never)
      );
      expect(attested).toMatchObject({ data: { emailVerified: true } });
    });

    // SAML is `never-attests`: BoxyHQ carries no `email_verified` on any path, so there is no claim to
    // honour and the row is verified as it always has been — whatever value happens to arrive.
    test("saml: stays verified, because no claim can exist", async () => {
      const result = await runWithSsoRequestContext(() =>
        before(
          { id: "u1", email: "a@b.com", emailVerified: false } as never,
          { path: "/callback/:providerId", params: { providerId: "saml" } } as never
        )
      );
      expect(result).toMatchObject({ data: { emailVerified: true } });
    });
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

  // ENG-2293: on a closed instance (SIGNUP_ENABLED=false, not fresh, multi-org disabled),
  // a direct POST to Better Auth's native /sign-up/email must be blocked — the hook is the
  // last line of defense, since the page and the server action both gate correctly.
  describe("closed-instance policy", () => {
    beforeEach(() => {
      constantsOverrides.SIGNUP_ENABLED = false;
      vi.mocked(getIsFreshInstance).mockResolvedValue(false);
      vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    });

    test("blocks a raw credential sign-up on a closed instance", async () => {
      vi.mocked(isSignupDomainAllowed).mockReturnValue(false); // raw endpoint, not through the action
      vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(false); // self-hosted: domain block is a no-op
      await expect(
        before({ id: "u1", email: "intruder@example.com" } as never, { path: "/sign-up/email" } as never)
        // The stable code is the contract callers localize against; the message is display copy, so a
        // reworded message must not fail this test and a dropped code must.
      ).rejects.toMatchObject({ status: "FORBIDDEN", body: { code: SIGNUP_DISABLED_ERROR_CODE } });
      expect(gateSsoProvisioning).not.toHaveBeenCalled();
    });

    test("still allows the first administrator during fresh-instance setup", async () => {
      vi.mocked(getIsFreshInstance).mockResolvedValue(true);
      vi.mocked(isSignupDomainAllowed).mockReturnValue(false);
      vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(false);
      const result = await before(
        { id: "u1", email: "admin@example.com" } as never,
        { path: "/sign-up/email" } as never
      );
      expect(result).toBeUndefined();
    });

    test("still allows a credential sign-up when public signup is open", async () => {
      constantsOverrides.SIGNUP_ENABLED = true;
      vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
      vi.mocked(isSignupDomainAllowed).mockReturnValue(false);
      vi.mocked(isSignupEmailDomainBlocked).mockResolvedValue(false);
      const result = await before(
        { id: "u1", email: "user@example.com" } as never,
        { path: "/sign-up/email" } as never
      );
      expect(result).toBeUndefined();
    });

    test("still allows a credential sign-up via the action (domain already enforced)", async () => {
      vi.mocked(isSignupDomainAllowed).mockReturnValue(true); // action marked the scope
      const result = await before(
        { id: "u1", email: "user@example.com" } as never,
        { path: "/sign-up/email" } as never
      );
      expect(result).toBeUndefined();
    });
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
  const samlCtx = { path: "/callback/:providerId", params: { providerId: "saml" } };

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
    path: "/callback/:providerId",
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
    path: "/callback/:providerId",
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

/**
 * ENG-2589 — the framework boundary the unit tests above cannot see. Better Auth derives
 * `emailVerified` from GitHub's /user/emails lookup (`verified ?? false`) before `user.create.before`
 * runs, hands it to the hook in its `user` argument, and `createWithHooks` shallow-merges the hook's
 * return over it. These drive a REAL Better Auth instance through the full sign-in → callback flow —
 * with `fetch` stubbed at the GitHub boundary — and assert the row that is actually persisted, so a
 * change in the provider's signal derivation or in the hook-merge order fails here, not in production.
 *
 * The github registration is deliberately minimal: production's `mapProfileToUser` returns only
 * `{ email }` (better-auth-providers.ts), so Better Auth's own emailVerified survives the profile
 * mapping identically in both shapes.
 */
describe("SSO sign-up persists the IdP's email_verified claim (real Better Auth, ENG-2589)", () => {
  const BASE_URL = "https://app.formbricks.test";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const signUpThroughGithub = async (verifiedAtIdp: boolean) => {
    const { betterAuth } = await import("better-auth");
    const { memoryAdapter } = await import("better-auth/adapters/memory");
    const db: Record<string, Record<string, unknown>[]> = {
      user: [],
      session: [],
      account: [],
      verification: [],
    };
    const auth = betterAuth({
      baseURL: BASE_URL,
      secret: "eng-2589-email-verified-boundary-secret",
      database: memoryAdapter(db),
      user: {
        // The two fields the account.create.after hook denormalizes (parity with auth.ts).
        additionalFields: {
          identityProvider: { type: "string", required: false, input: false },
          identityProviderAccountId: { type: "string", required: false, input: false },
        },
      },
      socialProviders: { github: { clientId: "gh-id", clientSecret: "gh-secret" } },
      databaseHooks: ssoDatabaseHooks,
    });

    // Leg 1: sign-in issues the authorization URL, the state row, and its signed cookie.
    const signIn = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ provider: "github", callbackURL: "/" }),
      })
    );
    expect(signIn.status).toBe(200);
    const { url } = (await signIn.json()) as { url: string };
    const state = new URL(url).searchParams.get("state") ?? "";
    expect(state).not.toBe("");
    const cookie = (signIn.headers.getSetCookie?.() ?? []).map((v) => v.split(";")[0]).join("; ");

    // Leg 2: the callback, with GitHub's token + profile + emails endpoints stubbed. The /user/emails
    // `verified` flag is the IdP's actual attestation — the value under test.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (requested.startsWith("https://github.com/login/oauth/access_token")) {
          return Response.json({ access_token: "gh-token", token_type: "bearer" });
        }
        if (requested.startsWith("https://api.github.com/user/emails")) {
          return Response.json([{ email: "squatter@corp.test", primary: true, verified: verifiedAtIdp }]);
        }
        if (requested.startsWith("https://api.github.com/user")) {
          return Response.json({
            id: 4242,
            login: "squatter",
            name: "Squatter",
            email: "squatter@corp.test",
          });
        }
        throw new Error(`unexpected outbound fetch: ${requested}`);
      })
    );

    const callback = await runWithSsoRequestContext(() =>
      auth.handler(
        new Request(`${BASE_URL}/api/auth/callback/github?code=gh-code&state=${state}`, {
          headers: { cookie },
        })
      )
    );

    // Anchor the flow itself: a rejected callback would leave db.user empty and a bare
    // `toMatchObject` on undefined would blame the wrong thing.
    expect(callback.status).toBeGreaterThanOrEqual(300);
    expect(db.user).toHaveLength(1);
    return db.user[0];
  };

  test("github reporting the address as unverified must not mint a verified account", async () => {
    const user = await signUpThroughGithub(false);
    expect(user).toMatchObject({ email: "squatter@corp.test", emailVerified: false });
  });

  test("github reporting the address as verified keeps it verified", async () => {
    const user = await signUpThroughGithub(true);
    expect(user).toMatchObject({ email: "squatter@corp.test", emailVerified: true });
  });
});
