import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  INVITE_TOKEN_INVALID_ERROR_CODE,
  PASSWORD_COMPROMISED_ERROR_CODE,
  SIGNUP_DISABLED_ERROR_CODE,
  SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { getIsFreshInstance } from "@/lib/instance/service";
import { createEmailToken, verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getUserByEmail } from "@/lib/user/service";
import { auth } from "@/modules/auth/lib/auth";
import { isPasswordCompromisedError } from "@/modules/auth/lib/better-auth-hibp";
import {
  SIGNUP_INTENT_COOKIE_NAME,
  SIGNUP_INTENT_COOKIE_OPTIONS,
  readSignupIntent,
} from "@/modules/auth/lib/signup-intent";
import { updateUser } from "@/modules/auth/lib/user";
import { deleteInvite, getInvite, resolveInviteMatch } from "@/modules/auth/signup/lib/invite";
import { verifyTurnstileToken } from "@/modules/auth/signup/lib/utils";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { subscribeUserToMailingList } from "@/modules/ee/mailing/lib/mailing-subscription";
import { sendInviteAcceptedEmail } from "@/modules/email";
import { POST } from "./route";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));

const requestHeaders = new Headers({ "x-formbricks-client-ip": "203.0.113.7" });
/** Captures cookies the route sets, so the ENG-2562 sign-up intent cookie can be asserted on. */
let setCookies: { name: string; value: string; options: unknown }[] = [];
const mockNextRequestData = () => {
  setCookies = [];
  vi.mocked(headers).mockResolvedValue(requestHeaders as never);
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
    set: (name: string, value: string, options: unknown) => setCookies.push({ name, value, options }),
  } as never);
};

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: vi.fn(), applyRateLimit: vi.fn() }));

// Signup is Better Auth-native (ENG-1054): the credential user + verification email come from
// auth.api.signUpEmail.
vi.mock("@/modules/auth/lib/auth", () => ({ auth: { api: { signUpEmail: vi.fn() } } }));
vi.mock("@/modules/auth/lib/better-auth-hibp", () => ({ isPasswordCompromisedError: vi.fn() }));
vi.mock("@/lib/user/service", () => ({ getUserByEmail: vi.fn() }));
vi.mock("@/modules/auth/lib/user", () => ({ updateUser: vi.fn() }));
vi.mock("@/lib/jwt", () => ({ verifyInviteToken: vi.fn(), createEmailToken: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/invite", () => ({
  getInvite: vi.fn(),
  deleteInvite: vi.fn(),
  resolveInviteMatch: vi.fn(),
}));
vi.mock("@/modules/auth/signup/lib/team", () => ({ createTeamMembership: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/utils", () => ({ verifyTurnstileToken: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ createMembership: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ createOrganization: vi.fn(), getOrganization: vi.fn() }));
vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
  identifyPostHogPerson: vi.fn(),
  getEmailDomain: (email: string) => email.split("@")[1]?.toLowerCase() || undefined,
}));
vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  ensureCloudStripeSetupForOrganization: vi.fn(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: vi.fn() }));
vi.mock("@/modules/ee/mailing/lib/mailing-subscription", () => ({ subscribeUserToMailingList: vi.fn() }));
vi.mock("@/modules/email", () => ({ sendInviteAcceptedEmail: vi.fn() }));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({ createWorkspace: vi.fn() }));
vi.mock("@/lib/instance/service", () => ({ getIsFreshInstance: vi.fn() }));

// Getters so individual tests can flip the Cloud gate / invite kill-switch / Turnstile at runtime. The
// real signup-email-domain utility reads these through live bindings; only the constants are mocked.
const constantsOverrides = vi.hoisted(() => ({
  IS_FORMBRICKS_CLOUD: false,
  SIGNUP_DOMAIN_CHECK_ON_INVITES: false,
  SIGNUP_ENABLED: true,
  IS_TURNSTILE_CONFIGURED: false,
  TURNSTILE_SECRET_KEY: undefined as string | undefined,
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "http://localhost:3000",
  // Reached through the ENG-2562 sign-up intent cookie (signup-intent.ts → lib/crypto), which reads
  // both at module load. A 64-char hex key so `symmetricEncrypt` takes its normal path.
  ENCRYPTION_KEY: "0".repeat(64),
  AUTH_SECRET: "test-auth-secret",
  get IS_TURNSTILE_CONFIGURED() {
    return constantsOverrides.IS_TURNSTILE_CONFIGURED;
  },
  get TURNSTILE_SECRET_KEY() {
    return constantsOverrides.TURNSTILE_SECRET_KEY;
  },
  get IS_FORMBRICKS_CLOUD() {
    return constantsOverrides.IS_FORMBRICKS_CLOUD;
  },
  get SIGNUP_DOMAIN_CHECK_ON_INVITES() {
    return constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES;
  },
  get SIGNUP_ENABLED() {
    return constantsOverrides.SIGNUP_ENABLED;
  },
}));

const createdUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  locale: "en-US",
  notificationSettings: { alert: {} },
};

const validInvite = {
  id: "invite-1",
  organizationId: "org-1",
  role: "member",
  teamIds: null,
  creator: { name: "Owner", email: "owner@example.com", locale: "en-US" },
};

// Mirrors what signup-form.tsx actually posts: it always sends the field, as `inviteToken ?? ""`,
// so an uninvited sign-up arrives with an empty string rather than undefined.
const baseInput = { name: "Ada", email: "Ada@Example.com", password: "Password123!", inviteToken: "" };

const signUp = (body: unknown = baseInput, extraHeaders: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(
    new NextRequest("http://localhost/api/internal/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {} as never
  );

/** The invariant answer, whichever path the sign-up took. */
const SUCCESS = { data: { success: true, emailToken: "display-token" } };

const reasonOf = async (response: Response) => (await response.json()).details?.reason;
const auditEvents = () => vi.mocked(queueAuditEvent).mock.calls.map(([event]) => event);

const acceptInvite = () => {
  vi.mocked(resolveInviteMatch).mockResolvedValue("valid");
  vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: "invite-1", email: "ada@example.com" } as never);
  vi.mocked(getInvite).mockResolvedValue(validInvite as never);
};

beforeEach(() => {
  vi.resetAllMocks();
  mockNextRequestData();
  constantsOverrides.IS_FORMBRICKS_CLOUD = false;
  constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = false;
  constantsOverrides.SIGNUP_ENABLED = true;
  constantsOverrides.IS_TURNSTILE_CONFIGURED = false;
  constantsOverrides.TURNSTILE_SECRET_KEY = undefined;
  vi.mocked(getIsFreshInstance).mockResolvedValue(true);
  vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true } as never);
  vi.mocked(getUserByEmail).mockResolvedValue(createdUser as never);
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  vi.mocked(isPasswordCompromisedError).mockReturnValue(false);
  vi.mocked(queueAuditEvent).mockResolvedValue(undefined);
  vi.mocked(createEmailToken).mockReturnValue("display-token");
  // Real Better Auth resolves with the user it wrote; the route compares that id against the persisted
  // row to tell a creation from a duplicate (ENG-2091). Matching ids => "created".
  vi.mocked(auth.api.signUpEmail).mockResolvedValue({ user: createdUser } as never);
});

describe("POST /api/internal/signups — the answer and the guards around it", () => {
  test("answers { success: true } without a session", async () => {
    const response = await signUp();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUCCESS);
  });

  // Replaces `createEmailTokenAction`, which the form called after signing up: it looked the address up
  // and refused an unknown one, which made it a registration oracle on its own budget.
  test("carries the display token for the submitted address, minted without looking the user up", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { ...createdUser, id: "synthetic-generated-id" },
    } as never);

    const response = await signUp();

    expect(await response.json()).toEqual(SUCCESS);
    expect(createEmailToken).toHaveBeenCalledWith("ada@example.com");
  });

  test("mints no token for a refused sign-up", async () => {
    constantsOverrides.SIGNUP_ENABLED = false;
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);

    expect((await signUp()).status).toBe(422);
    expect(createEmailToken).not.toHaveBeenCalled();
  });

  test("creates no account when the token cannot be minted", async () => {
    vi.mocked(createEmailToken).mockImplementation(() => {
      throw new Error("ENCRYPTION_KEY is not set");
    });

    expect((await signUp()).status).toBe(500);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test("spends the client IP's sign-up budget first, and answers 429 without auditing when it is spent", async () => {
    vi.mocked(applyIPRateLimit).mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60)
    );

    const response = await signUp();

    expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.signup);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    expect(queueAuditEvent).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF), though there is no session to ride", async () => {
    expect((await signUp(baseInput, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(applyIPRateLimit).not.toHaveBeenCalled();
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test.each([
    ["no email", { name: "Ada", password: "Password123!" }],
    ["a password too short", { ...baseInput, password: "short" }],
    ["an unknown field", { ...baseInput, role: "owner" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await signUp(body)).status).toBe(400);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test(`refuses a body over ${PRE_LOGIN_BODY_LIMIT_BYTES} bytes with 413`, async () => {
    const body = JSON.stringify({ ...baseInput, name: "a".repeat(PRE_LOGIN_BODY_LIMIT_BYTES) });

    expect((await signUp(body)).status).toBe(413);
    expect(applyIPRateLimit).not.toHaveBeenCalled();
  });

  test("lets an unexpected failure through as a 500, audited as a failure", async () => {
    vi.mocked(auth.api.signUpEmail).mockRejectedValue(new Error("db down"));
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    expect((await signUp()).status).toBe(500);
    expect(auditEvents()).toEqual([expect.objectContaining({ action: "created", status: "failure" })]);
  });
});

describe("POST /api/internal/signups — Turnstile", () => {
  beforeEach(() => {
    constantsOverrides.IS_TURNSTILE_CONFIGURED = true;
    constantsOverrides.TURNSTILE_SECRET_KEY = "secret";
  });

  test("verifies the token before creating the account", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);

    expect((await signUp({ ...baseInput, turnstileToken: "token" })).status).toBe(200);
    expect(verifyTurnstileToken).toHaveBeenCalledWith("secret", "token");
  });

  test("creates no account when the token fails verification", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false);

    expect((await signUp({ ...baseInput, turnstileToken: "token" })).status).toBe(500);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test("answers 400 when the token is missing", async () => {
    expect((await signUp(baseInput)).status).toBe(400);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/signups — signup verification email callbackURL", () => {
  test("omits the callbackURL (BA defaults to '/') for a direct, non-invite signup", async () => {
    await signUp();

    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: { email: "ada@example.com", password: "Password123!", name: "Ada" },
      headers: requestHeaders,
    });
  });

  // The other half of the suppression below: a REAL creation must still be audited. Without this, a bug
  // that skipped the entry unconditionally would silence every `created` event and no test would notice.
  test("audits a real creation, attributed to the new account", async () => {
    await signUp();

    expect(auditEvents()).toEqual([
      expect.objectContaining({
        action: "created",
        targetType: "user",
        targetId: createdUser.id,
        status: "success",
        newObject: createdUser,
      }),
    ]);
  });

  test("does not point the verification callback at /invite for invite signups (ENG-1527)", async () => {
    acceptInvite();

    await signUp({ ...baseInput, inviteToken: "invite-jwt-123" });

    // The invite is accepted + deleted during signup, so a /invite callback would render "Invite Not
    // Found" once the verification link is clicked.
    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: { email: "ada@example.com", password: "Password123!", name: "Ada" },
      headers: requestHeaders,
    });
    expect(auditEvents()).toEqual([expect.objectContaining({ organizationId: "org-1", status: "success" })]);
  });

  // The notice to the inviter is sent after the membership exists, so a failed send must not fail the
  // sign-up or leave the used invite behind.
  test("completes an invite sign-up and deletes the invite when the inviter's notice fails", async () => {
    acceptInvite();
    vi.mocked(sendInviteAcceptedEmail).mockRejectedValue(new Error("smtp unavailable"));

    const response = await signUp({ ...baseInput, inviteToken: "invite-jwt-123" });

    expect(await response.json()).toEqual(SUCCESS);
    expect(createMembership).toHaveBeenCalled();
    expect(deleteInvite).toHaveBeenCalledWith("invite-1");
  });

  // Regression: signup-form.tsx sends `inviteToken: inviteToken ?? ""`, so an uninvited sign-up arrives
  // with an empty string. Guarding the "unusable invite" check on `!== undefined` rather than
  // truthiness rejected every public sign-up with INVITE_TOKEN_INVALID_ERROR_CODE.
  test.each(["", "   ", undefined])(
    "treats %p as no invite and completes an ordinary sign-up",
    async (inviteToken) => {
      vi.mocked(resolveInviteMatch).mockResolvedValue("missing");

      const response = await signUp({ ...baseInput, inviteToken });

      expect(await response.json()).toEqual(SUCCESS);
      expect(auth.api.signUpEmail).toHaveBeenCalled();
      // No invite means no membership grant — the org-creation path handles it instead.
      expect(createMembership).not.toHaveBeenCalled();
    }
  );

  // Regression: an invite binds a role in an organization to one address. Accepting it only on a valid
  // signature meant a leaked or forwarded invite link could be redeemed with any address.
  test.each(["email_mismatch", "invalid_or_expired", "verification_error", "missing"] as const)(
    "refuses to grant membership when the invite resolves as %s",
    async (inviteMatch) => {
      vi.mocked(resolveInviteMatch).mockResolvedValue(inviteMatch);
      vi.mocked(verifyInviteToken).mockReturnValue({
        inviteId: "invite-1",
        email: "someone-else@example.com",
      } as never);

      const response = await signUp({ ...baseInput, inviteToken: "invite-jwt-123" });

      // The stable code, not just "some error": the sign-up form maps this to localized copy.
      expect(response.status).toBe(422);
      expect(await reasonOf(response)).toBe(INVITE_TOKEN_INVALID_ERROR_CODE);
      expect(createMembership).not.toHaveBeenCalled();
      // Rejected before the account is written, so a bad token leaves no orphaned user behind.
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
      // A refusal is still audited, as a failure.
      expect(auditEvents()).toEqual([expect.objectContaining({ action: "created", status: "failure" })]);
    }
  );

  test("names a breached password with the code the form puts under the password field", async () => {
    vi.mocked(auth.api.signUpEmail).mockRejectedValue(new Error("compromised"));
    vi.mocked(isPasswordCompromisedError).mockReturnValue(true);

    const response = await signUp();

    expect(response.status).toBe(422);
    expect(await reasonOf(response)).toBe(PASSWORD_COMPROMISED_ERROR_CODE);
  });

  // ENG-2091: with requireEmailVerification + autoSignIn:false, Better Auth does NOT throw on a
  // duplicate — it returns 200 with a SYNTHETIC user (generated id, nothing written). The real contract
  // is pinned against the live framework in signup-duplicate-email.integration.test.ts.
  test("treats a synthetic-user response as already-existed, without post-creation side effects", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { ...createdUser, id: "synthetic-generated-id" },
    } as never);

    const response = await signUp();

    expect(await response.json()).toEqual(SUCCESS); // same answer as a real signup
    expect(subscribeUserToMailingList).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled(); // no locale write on someone else's account
    expect(capturePostHogEvent).not.toHaveBeenCalled();
    // No `created` event at all for an account that was not created (S1).
    expect(queueAuditEvent).not.toHaveBeenCalled();
    // ENG-2562: and no sign-up intent cookie. The caller is an unauthenticated stranger who has proven
    // nothing about an account that already exists; arming one would hand them the auto-sign-in on the
    // victim's eventual verification click, and would leak that the address is registered.
    expect(setCookies).toEqual([]);
  });

  // ENG-2562: the other half of the same rule — a real creation DOES get the cookie, with exactly the
  // attributes the server action set.
  test("issues a sign-up intent cookie bound to the created user", async () => {
    await signUp();

    expect(setCookies).toHaveLength(1);
    const [intent] = setCookies;
    expect(intent.name).toBe(SIGNUP_INTENT_COOKIE_NAME);
    expect(intent.options).toBe(SIGNUP_INTENT_COOKIE_OPTIONS);
    // Bound to this account and not readable as plaintext: assert through the reader, not the shape.
    expect(readSignupIntent(intent.value)).toEqual({ userId: createdUser.id, reason: "valid" });
  });

  // The catch branch is still live: flipping EMAIL_VERIFICATION_DISABLED / autoSignIn makes Better Auth
  // throw USER_ALREADY_EXISTS instead of answering synthetically, so both signals must classify.
  test("treats a thrown duplicate as already-existed too", async () => {
    vi.mocked(auth.api.signUpEmail).mockRejectedValue(new Error("user already exists"));

    const response = await signUp();

    expect(await response.json()).toEqual(SUCCESS);
    expect(subscribeUserToMailingList).not.toHaveBeenCalled();
    expect(queueAuditEvent).not.toHaveBeenCalled();
  });

  // Regression: signup/page.tsx requires a valid invite once public sign-up is closed, but the sign-up
  // itself enforced nothing — so anyone could POST it and create an account on a closed instance.
  describe("closed instance policy", () => {
    beforeEach(() => {
      constantsOverrides.SIGNUP_ENABLED = false;
      vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    });

    test("rejects an uninvited signup and creates no user", async () => {
      const response = await signUp();

      expect(response.status).toBe(422);
      expect(await reasonOf(response)).toBe(SIGNUP_DISABLED_ERROR_CODE);
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    test("still allows the first administrator during fresh-instance setup", async () => {
      vi.mocked(getIsFreshInstance).mockResolvedValue(true);

      expect((await signUp()).status).toBe(200);
      expect(auth.api.signUpEmail).toHaveBeenCalled();
    });

    test("still allows a signup backed by a valid matching invite", async () => {
      acceptInvite();

      expect((await signUp({ ...baseInput, inviteToken: "invite-jwt-123" })).status).toBe(200);
      expect(createMembership).toHaveBeenCalled();
    });
  });
});

describe("POST /api/internal/signups — personal email domain block (Cloud)", () => {
  const blockedUser = { ...createdUser, id: "user-2", email: "spammer@gmail.com", name: "Spammer" };
  const blockedInput = {
    name: "Spammer",
    email: "spammer@gmail.com",
    password: "Password123!",
    inviteToken: "",
  };

  beforeEach(() => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(getUserByEmail).mockResolvedValue(blockedUser as never);
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({ user: blockedUser } as never);
  });

  test("blocks a personal-domain signup and creates no user", async () => {
    const response = await signUp(blockedInput);

    expect(response.status).toBe(422);
    expect(await reasonOf(response)).toBe(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test("allows a personal-domain signup backed by a valid matching invite", async () => {
    acceptInvite();

    expect((await signUp({ ...blockedInput, inviteToken: "invite-jwt-123" })).status).toBe(200);
    expect(auth.api.signUpEmail).toHaveBeenCalled();
  });

  test("blocks when the invite email does not match the signup email", async () => {
    vi.mocked(resolveInviteMatch).mockResolvedValue("email_mismatch");

    // A mismatched invite is rejected outright rather than merely losing its domain exemption, so no
    // user row is created for it either.
    const response = await signUp({ ...blockedInput, inviteToken: "invite-jwt-123" });

    expect(await reasonOf(response)).toBe(INVITE_TOKEN_INVALID_ERROR_CODE);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test("blocks a personal-domain invite when the kill-switch is enabled", async () => {
    constantsOverrides.SIGNUP_DOMAIN_CHECK_ON_INVITES = true;
    // The invite itself is usable; the kill-switch is what removes its domain exemption.
    vi.mocked(resolveInviteMatch).mockResolvedValue("valid");

    const response = await signUp({ ...blockedInput, inviteToken: "invite-jwt-123" });

    expect(await reasonOf(response)).toBe(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  test("allows a company-domain signup", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({ ...blockedUser, email: "person@acme-corp.com" } as never);

    const response = await signUp({
      name: "Person",
      email: "person@acme-corp.com",
      password: "Password123!",
    });

    expect(response.status).toBe(200);
    expect(auth.api.signUpEmail).toHaveBeenCalled();
  });
});
