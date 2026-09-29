import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";

/**
 * ENG-3189 at the FRAMEWORK boundary: Better Auth's native `POST /update-user` against a real
 * Postgres, with no `updateUserAction` in the way.
 *
 * That endpoint is where the bug lived, so it is the boundary the regression test drives. The SSO name
 * lock is enforced in `updateUserAction`, and the profile form renders the input disabled — but
 * `app/api/auth/[...all]/route.ts` mounts `auth.handler` raw, so Better Auth served `/update-user`
 * beside our own surface and an authenticated `fetch` from the browser console wrote the name anyway
 * (200, unaudited), or threw an unhandled 500 on `image`, which `User` has no column for.
 *
 * Driven through `auth.handler` with a real `Request` rather than `auth.api.updateUser`: the fix is
 * `disabledPaths`, which Better Auth applies in the HTTP router alone (`api/index.mjs`), so only this
 * layer can show it — and the status code an attacker receives is the assertion that matters.
 */
const UPDATE_USER_URL = "http://localhost:3000/api/auth/update-user";
const ORIGIN = "http://localhost:3000";

const EMAIL = "sso-user@corporate-example.com";
const PASSWORD = "Correct-Horse1";
const IDP_NAME = "Ada Lovelace";

/**
 * An SSO user who is signed in — the state the report was filed from.
 *
 * Built by signing up with credentials and then flipping `identityProvider`, because an SSO sign-up
 * needs a live IdP. The session is what the endpoint authenticates against and it survives the flip,
 * so the request this returns a cookie for is exactly the one the reporter made.
 */
const signedInSsoUser = async (): Promise<string> => {
  await auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: IDP_NAME },
    asResponse: true,
  });
  await prisma.user.update({ where: { email: EMAIL }, data: { emailVerified: true } });

  const res = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, asResponse: true });
  expect(res.status).toBe(200);
  const cookieHeader = res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  expect(cookieHeader).toContain("session_token");

  await prisma.user.update({ where: { email: EMAIL }, data: { identityProvider: "google" } });
  return cookieHeader;
};

/** The authenticated POST from the bug report, verbatim in shape. */
const rawUpdateUser = (cookieHeader: string, body: Record<string, unknown>): Promise<Response> =>
  runWithSsoRequestContext(() =>
    auth.handler(
      new Request(UPDATE_USER_URL, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN, cookie: cookieHeader },
        body: JSON.stringify(body),
      })
    )
  );

const storedName = async (): Promise<string | null> =>
  (await prisma.user.findUnique({ where: { email: EMAIL }, select: { name: true } }))?.name ?? null;

beforeEach(async () => {
  await resetDb();
});

describe("raw Better Auth /update-user (real Postgres)", () => {
  test("refuses a name write from an SSO user and leaves the IdP name in place", async () => {
    const cookieHeader = await signedInSsoUser();

    const response = await rawUpdateUser(cookieHeader, { name: "bypassed" });

    // Before the fix: 200 {"status":true}, and the name stuck until the next sign-in reverted it.
    expect(response.status).toBe(404);
    expect(await storedName()).toBe(IDP_NAME);
  });

  test("refuses an image write instead of throwing an unhandled 500", async () => {
    const cookieHeader = await signedInSsoUser();

    const response = await rawUpdateUser(cookieHeader, { image: "https://example.com/x.png" });

    // Before the fix: 500 with an empty body — the write reached Prisma for a column `User` lacks.
    expect(response.status).toBe(404);
  });

  /**
   * The lock is on the endpoint, not on who is calling it. A credential user has no more business
   * writing their profile here than an SSO one does: `updateUserAction` is what owns the audit entry,
   * and a write that lands through this route leaves none (the ENG-2347 class).
   */
  test("refuses a credential user's name write too", async () => {
    await auth.api.signUpEmail({
      body: { email: "credential@example.com", password: PASSWORD, name: "Grace Hopper" },
      asResponse: true,
    });
    await prisma.user.update({ where: { email: "credential@example.com" }, data: { emailVerified: true } });
    const res = await auth.api.signInEmail({
      body: { email: "credential@example.com", password: PASSWORD },
      asResponse: true,
    });
    const cookieHeader = res.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");

    const response = await rawUpdateUser(cookieHeader, { name: "renamed" });

    expect(response.status).toBe(404);
    const user = await prisma.user.findUnique({
      where: { email: "credential@example.com" },
      select: { name: true },
    });
    expect(user?.name).toBe("Grace Hopper");
  });
});
