import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSession } from "@/modules/auth/lib/session";
import { revokeSessionByToken } from "@/modules/auth/lib/session-revocation";
import { SsoRecoveryError, completeSsoRecovery } from "@/modules/ee/sso/lib/sso-recovery";
import { GET } from "./route";

/**
 * The completion route had no test of its own, which is part of why the ENG-2783 loop went unnoticed:
 * nothing pinned what it reads out of the URL, so the parameter could change shape without a failure.
 */

const WEBAPP_URL = "https://test-webapp-url.com";

vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/auth/lib/session-revocation", () => ({ revokeSessionByToken: vi.fn() }));

// Only the extraction is stubbed, and only because it verifies Better Auth's HMAC over the cookie —
// minting a correctly signed one here would test the signature, which `session-cookie.test.ts` already
// covers. The cookie NAMES stay real, since the clearing assertions below depend on them.
vi.mock("@/modules/auth/lib/session-cookie", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/auth/lib/session-cookie")>()),
  getSessionTokenFromCookieHeader: vi.fn((header: string | null) =>
    header?.includes("session_token=") ? "token-abc" : null
  ),
}));

// `SsoRecoveryError` and `getSsoRecoveryFailureRedirectUrl` stay real — the route branches on
// `instanceof` and builds its redirect from the second, so stubbing either would test the stub.
vi.mock("@/modules/ee/sso/lib/sso-recovery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/sso/lib/sso-recovery")>()),
  completeSsoRecovery: vi.fn(),
}));

const request = (url: string, cookie?: string) =>
  new Request(url, cookie ? { headers: { cookie } } : undefined);

const location = (response: Response) => response.headers.get("location");

describe("GET /api/auth/sso/recovery/complete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: "user_1" } } as never);
  });

  test("sends the user on to the callback the completed recovery returns", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(`${WEBAPP_URL}/environments/env_1`);

    const response = await GET(request(`${WEBAPP_URL}/api/auth/sso/recovery/complete?state=state-id`));

    expect(completeSsoRecovery).toHaveBeenCalledWith(
      expect.objectContaining({ stateId: "state-id", sessionUserId: "user_1" })
    );
    expect(location(response)).toBe(`${WEBAPP_URL}/environments/env_1`);
  });

  test("hands the session token through, so the post-commit sweep can spare it", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(WEBAPP_URL);

    await GET(
      request(
        `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=state-id`,
        "formbricks.session_token=token-abc.signature"
      )
    );

    expect(vi.mocked(completeSsoRecovery).mock.calls[0][0].sessionToken).toBeDefined();
  });

  test("redirects to the failure page when no state is present", async () => {
    const response = await GET(request(`${WEBAPP_URL}/api/auth/sso/recovery/complete`));

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  /**
   * The parameter changed from a JWT payload to an opaque reference. A stale `?intent=` link — one
   * emailed before the deploy, valid for up to a day — must land on the ordinary failure page rather
   * than being treated as a state id.
   */
  test("does not accept the old intent parameter", async () => {
    const response = await GET(request(`${WEBAPP_URL}/api/auth/sso/recovery/complete?intent=some.jwt.value`));

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  test("carries the intent's own callback into the failure redirect", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(
      new SsoRecoveryError(`${WEBAPP_URL}/environments/env_1`)
    );

    const response = await GET(request(`${WEBAPP_URL}/api/auth/sso/recovery/complete?state=state-id`));

    expect(location(response)).toContain(
      `callbackUrl=${encodeURIComponent(`${WEBAPP_URL}/environments/env_1`)}`
    );
  });

  test("omits the callback when the intent could not be read at all", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(new SsoRecoveryError());

    const response = await GET(request(`${WEBAPP_URL}/api/auth/sso/recovery/complete?state=unknown`));

    expect(location(response)).toContain("error=OAuthAccountNotLinked");
    expect(location(response)).not.toContain("callbackUrl=");
  });

  test("still redirects safely when the failure is not one of ours", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(new Error("redis exploded"));

    const response = await GET(request(`${WEBAPP_URL}/api/auth/sso/recovery/complete?state=state-id`));

    expect(location(response)).toContain("error=OAuthAccountNotLinked");
    expect(location(response)).not.toContain("callbackUrl=");
  });

  test("clears the session cookies and revokes the session it was given on failure", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(new SsoRecoveryError());

    const response = await GET(
      request(
        `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=state-id`,
        "formbricks.session_token=token-abc.signature"
      )
    );

    const setCookies = response.headers.getSetCookie().join("\n");
    expect(setCookies).toContain("formbricks.session_token=;");
    expect(setCookies).toContain("__Secure-formbricks.session_token=;");
    expect(revokeSessionByToken).toHaveBeenCalled();
  });
});
