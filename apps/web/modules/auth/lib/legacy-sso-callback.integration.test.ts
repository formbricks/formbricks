import { describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/auth/[...all]/route";
import { auth } from "@/modules/auth/lib/auth";
import { runWithSsoRequestContext } from "@/modules/ee/sso/lib/sso-request-context";

/**
 * ENG-2343 at the ROUTER boundary: the pinned SSO callback URL against a real Better Auth instance.
 *
 * `redirectURI` makes Better Auth advertise `/api/auth/oauth2/callback/{providerId}` — the URL customer
 * IdPs have had registered since v5.2 — while 1.7 mounts its handler at `/callback/:id`. The unit tests
 * cover the mapper's string logic and that the route calls it, but both run against a MOCKED
 * `auth.handler`, so neither can show that the real router accepts the mapped path. That is the half of
 * the change that would fail in production: a path the router does not match is a 404 on every SSO
 * sign-in, and no amount of mapper unit-testing would reveal it.
 *
 * The claim asserted is exactly the claim the change makes: a request at the pinned URL is handled
 * *identically* to one at the path this version serves. Comparing the two responses rather than
 * hardcoding an expected status is deliberate — it stays true across Better Auth versions and does not
 * encode today's particular OAuth error, while still failing loudly if the mapping stops working.
 *
 * `saml` is the provider under test because it is the one pinned provider configured with explicit
 * endpoint URLs rather than a `discoveryUrl`, so registering it pulls in no outbound network call. State
 * validation runs before any token exchange in any case, so both requests fail at the same place.
 */

// Register the SAML generic provider: the config array is gated on ENTERPRISE_LICENSE_KEY, and the
// provider itself on SAML_OAUTH_ENABLED. Without a registered provider the callback would answer
// identically for both paths for the *wrong* reason (an unknown provider), and the comparison below
// would pass while proving nothing.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  ENTERPRISE_LICENSE_KEY: "integration-license",
  SAML_OAUTH_ENABLED: true,
}));

const BASE = "http://localhost:3000";
const QUERY = "code=integration-code&state=integration-state";

const summarize = async (response: Response) => ({
  status: response.status,
  location: response.headers.get("location"),
});

/** Through the mounted route, so the mapper is in the path — the production call. */
const viaPinnedUrl = (path: string): Promise<Response> => GET(new Request(`${BASE}${path}?${QUERY}`));

/** Straight at Better Auth, bypassing the mapper — the control. */
const viaHandler = (path: string): Promise<Response> =>
  runWithSsoRequestContext(() => auth.handler(new Request(`${BASE}${path}?${QUERY}`)));

describe("pinned SSO callback URL reaches Better Auth's callback route", () => {
  test("the pinned path is handled exactly as the path this version serves", async () => {
    const [pinned, current] = await Promise.all([
      viaPinnedUrl("/api/auth/oauth2/callback/saml").then(summarize),
      viaHandler("/api/auth/callback/saml").then(summarize),
    ]);

    expect(pinned).toEqual(current);
  });

  /**
   * The control that gives the assertion above its meaning: without the mapper the pinned path is a 404,
   * because no Better Auth 1.7 route is mounted under `/oauth2/callback/`. An unpinned provider id takes
   * exactly that route, so this pins down *why* the comparison passes.
   */
  test("an unpinned provider id is not mapped and 404s", async () => {
    const response = await viaPinnedUrl("/api/auth/oauth2/callback/not-a-pinned-provider");

    expect(response.status).toBe(404);
  });

  test("the pinned path is reached, not 404ed", async () => {
    const response = await viaPinnedUrl("/api/auth/oauth2/callback/saml");

    expect(response.status).not.toBe(404);
  });
});
