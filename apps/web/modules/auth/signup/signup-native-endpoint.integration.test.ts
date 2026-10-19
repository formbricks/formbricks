import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";
import { sendVerificationLinkEmail } from "@/modules/email";

/**
 * ENG-3988: there is exactly one way to create a credential account, and it is `createUserAction`.
 *
 * Better Auth's native `POST /api/auth/sign-up/email` used to be a second way in. On Cloud it skipped
 * everything the action enforces — Turnstile, `ZUserEmail`/`ZUserPassword`, the app-level IP limit, org
 * provisioning and the audit entry — and still created the account. It is closed with `disabledPaths`,
 * which only Better Auth's HTTP router reads; this suite proves both halves against the real `auth`
 * instance: the route is gone, and the in-process call the action makes is not.
 *
 * Run on an OPEN, Cloud-shaped instance because that is where the route admitted anyone: on a closed
 * instance the policy gate already refused it (see signup-closed-instance.integration.test.ts).
 */
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  SIGNUP_ENABLED: true,
}));

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsMultiOrgEnabled: vi.fn(async () => true),
}));

const ORIGIN = "http://localhost:3000";
const EMAIL = "scripted@corporate-example.com";

/** The request from the report: no Turnstile token, a password `ZUserPassword` would refuse. */
const rawSignUp = (path: string, email: string): Promise<Response> =>
  runWithSsoRequestContext(() =>
    auth.handler(
      new Request(`${ORIGIN}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ email, password: "password", name: "Scripted" }),
      })
    )
  );

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("native Better Auth sign-up endpoint (real Postgres + Better Auth)", () => {
  // The canonical path, plus spellings that reach the same endpoint: a query string, and dot segments,
  // which `Request` collapses before `auth.handler` sees the URL. The rest never matched the route (the
  // router 404s a trailing slash and repeated slashes, and matches case- and encoding-exactly); they
  // are here so a Better Auth or router change cannot quietly open them.
  test.each([
    "/api/auth/sign-up/email",
    "/api/auth/sign-up/email?callbackURL=%2F",
    "/api/auth/x/../sign-up/email",
    "/api/auth/x/%2e%2e/sign-up/email",
    "/api/auth/sign-up/email/",
    "/api/auth//sign-up/email",
    "/api/auth/sign-up//email",
    "/api/auth/Sign-Up/Email",
    "/api/auth/sign%2Dup/email",
  ])("POST %s is a 404 and creates nothing", async (path) => {
    const response = await rawSignUp(path, EMAIL);

    expect(response.status).toBe(404);
    expect(await prisma.user.count()).toBe(0);
    expect(sendVerificationLinkEmail).not.toHaveBeenCalled();
  });

  test("the in-process call the action uses still creates the account", async () => {
    // The guard for `disabledPaths`: if it ever reached `auth.api` too, the sign-up form and /setup
    // would both stop creating accounts.
    const result = await auth.api.signUpEmail({
      body: { email: EMAIL, password: "Passw0rd!", name: "Ada" },
    });

    const persisted = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
    expect(persisted?.id).toBe(result.user.id);
    expect(sendVerificationLinkEmail).toHaveBeenCalledOnce();
  });
});
