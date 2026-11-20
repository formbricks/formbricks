import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getSession } from "@/modules/auth/lib/session";
import { revokeSessionByToken } from "@/modules/auth/lib/session-revocation";
import { SSO_RECOVERY_PROOF_COOKIE_NAME } from "@/modules/ee/sso/lib/recovery-proof";
import { SsoRecoveryError, cancelSsoRecovery, completeSsoRecovery } from "@/modules/ee/sso/lib/sso-recovery";
import { GET, POST } from "./route";

/**
 * The completion route had no test of its own, which is part of why the ENG-2783 loop went unnoticed:
 * nothing pinned what it reads out of the URL, so the parameter could change shape without a failure.
 */

const WEBAPP_URL = "https://test-webapp-url.com";

vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
// A deployment whose public URL (what the browser sends as Origin) is Better Auth's, not WEBAPP_URL.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "https://test-webapp-url.com",
  AUTH_TRUSTED_ORIGINS: ["https://public.example.com/"],
}));
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

// `SsoRecoveryError` and the redirect helpers in `sso-recovery` stay real — the route branches on
// `instanceof` and builds its redirects from the helpers, so stubbing any of them would test the stub.
vi.mock("@/modules/ee/sso/lib/sso-recovery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/sso/lib/sso-recovery")>()),
  completeSsoRecovery: vi.fn(),
  cancelSsoRecovery: vi.fn(),
}));

const request = (url: string, cookie?: string) =>
  new Request(url, cookie ? { headers: { cookie } } : undefined);

const location = (response: Response) => response.headers.get("location");

/** What a browser sends when the user clicks a same-origin form's submit button. */
const CLICKED_FORM = {
  origin: WEBAPP_URL,
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document",
  "sec-fetch-user": "?1",
};

/** The confirmation page's form submission: a clicked same-origin form, state (and action) in the body. */
const submit = (
  stateId: string,
  cookie?: string,
  headers: Record<string, string> = {},
  fields: Record<string, string> = {}
) =>
  new Request(`${WEBAPP_URL}/api/auth/sso/recovery/complete`, {
    method: "POST",
    // An empty string drops that header, so a case can model a browser that does not send it.
    headers: Object.fromEntries(
      Object.entries({
        "content-type": "application/x-www-form-urlencoded",
        ...CLICKED_FORM,
        ...(cookie ? { cookie } : {}),
        ...headers,
      }).filter(([, value]) => value !== "")
    ),
    body: new URLSearchParams({ state: stateId, action: "link", ...fields }).toString(),
  });

describe("/api/auth/sso/recovery/complete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: "user_1" } } as never);
  });

  /**
   * ENG-7395. The emailed link redirects here, and a GET can come from a mail scanner or from a click
   * the account holder did not mean as consent. Even a browser with a matching session AND a valid
   * proof cookie only gets the confirmation page.
   */
  test("a GET never links, even with a session and a proof cookie", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(`${WEBAPP_URL}/environments/env_1`);

    const response = await GET(
      request(
        `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=state-id`,
        `formbricks.session_token=token-abc.signature; ${SSO_RECOVERY_PROOF_COOKIE_NAME}=proof-value`
      )
    );

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(revokeSessionByToken).not.toHaveBeenCalled();
    expect(location(response)).toBe(`${WEBAPP_URL}/sso-recovery/confirm?state=state-id`);
  });

  test("the POST from the confirmation page links, with the proof and session it carries", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(`${WEBAPP_URL}/environments/env_1`);

    const response = await POST(
      submit(
        "state-id",
        `formbricks.session_token=token-abc.signature; ${SSO_RECOVERY_PROOF_COOKIE_NAME}=proof-value`
      )
    );

    expect(completeSsoRecovery).toHaveBeenCalledWith({
      stateId: "state-id",
      recoveryProof: "proof-value",
      sessionUserId: "user_1",
      sessionToken: "token-abc",
    });
    // 303 so the browser follows with a GET; a 307 would replay this POST against the callback.
    expect(response.status).toBe(303);
    expect(location(response)).toBe(`${WEBAPP_URL}/environments/env_1`);
  });

  test.each([["cross-site"], ["same-site"], ["none"]])(
    "refuses a %s submission without trying to link",
    async (fetchSite) => {
      const response = await POST(
        submit("state-id", "formbricks.session_token=token-abc.signature", { "sec-fetch-site": fetchSite })
      );

      expect(completeSsoRecovery).not.toHaveBeenCalled();
      expect(revokeSessionByToken).not.toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(location(response)).toContain("error=OAuthAccountNotLinked");
    }
  );

  /**
   * A background request from a script on this origin must not act for the account holder: `fetch()`
   * sends `cors`/`empty`, and a submission into a frame has `iframe` as its destination.
   */
  test.each([
    ["a same-origin fetch()", { "sec-fetch-mode": "cors", "sec-fetch-dest": "empty", "sec-fetch-user": "" }],
    ["a submission into a frame", { "sec-fetch-dest": "iframe" }],
    ["a request that is not a navigation", { "sec-fetch-mode": "cors" }],
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["no Origin at all", { origin: "" }],
  ])("refuses %s", async (_label, headers) => {
    const response = await POST(submit("state-id", "formbricks.session_token=token-abc.signature", headers));

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(cancelSsoRecovery).not.toHaveBeenCalled();
    expect(revokeSessionByToken).not.toHaveBeenCalled();
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  /**
   * Safari sends Fetch Metadata but never `Sec-Fetch-User` (WebKit bug 247697). Requiring it refused every
   * Safari user at the confirmation step.
   */
  test("accepts Safari's click, which carries no Sec-Fetch-User", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(WEBAPP_URL);

    await POST(submit("state-id", undefined, { "sec-fetch-user": "" }));

    expect(completeSsoRecovery).toHaveBeenCalled();
  });

  test("accepts a browser without Fetch Metadata when its Origin is this app's", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(WEBAPP_URL);
    const noFetchMetadata = Object.fromEntries(
      Object.keys(CLICKED_FORM)
        .filter((name) => name !== "origin")
        .map((name) => [name, ""])
    );

    await POST(submit("state-id", undefined, noFetchMetadata));

    expect(completeSsoRecovery).toHaveBeenCalled();
  });

  test("accepts the public origin Better Auth trusts, for a deployment behind a TLS proxy", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(WEBAPP_URL);

    await POST(submit("state-id", undefined, { origin: "https://public.example.com" }));

    expect(completeSsoRecovery).toHaveBeenCalled();
  });

  test("logs what a refused submission carried, so a misconfigured origin can be told from an attack", async () => {
    await POST(
      submit("state-id", undefined, { origin: "https://evil.example", "sec-fetch-site": "cross-site" })
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "https://evil.example", fetchSite: "cross-site" }),
      expect.stringContaining("Refused an SSO recovery confirmation")
    );
  });

  /** A cookie-keeping client that parsed the page (a link scanner) sends neither. */
  test("refuses a POST with neither Fetch Metadata nor an Origin", async () => {
    const bare = Object.fromEntries(Object.keys(CLICKED_FORM).map((name) => [name, ""]));

    await POST(submit("state-id", "formbricks.session_token=token-abc.signature", bare));

    expect(completeSsoRecovery).not.toHaveBeenCalled();
  });

  test.each([
    ["no action", { action: "" }],
    ["an unknown action", { action: "lnk" }],
  ])("refuses %s rather than linking", async (_label, fields) => {
    const response = await POST(submit("state-id", undefined, {}, fields));

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(cancelSsoRecovery).not.toHaveBeenCalled();
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  describe("cancel", () => {
    test("spends the recovery and the proof, links nothing, and sends the user home", async () => {
      const response = await POST(
        submit(
          "state-id",
          `formbricks.session_token=token-abc.signature; ${SSO_RECOVERY_PROOF_COOKIE_NAME}=proof-value`,
          {},
          { action: "cancel" }
        )
      );

      expect(cancelSsoRecovery).toHaveBeenCalledWith({
        stateId: "state-id",
        recoveryProof: "proof-value",
        sessionUserId: "user_1",
      });
      expect(completeSsoRecovery).not.toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(location(response)).toBe(`${WEBAPP_URL}/`);
      expect(response.headers.getSetCookie().join("\n")).toMatch(
        new RegExp(`${SSO_RECOVERY_PROOF_COOKIE_NAME}=;.*Max-Age=0`)
      );
    });

    test("a refused cancel is handled like a refused link", async () => {
      vi.mocked(cancelSsoRecovery).mockRejectedValue(new SsoRecoveryError("unproven"));

      const response = await POST(
        submit("state-id", "formbricks.session_token=token-abc.signature", {}, { action: "cancel" })
      );

      expect(revokeSessionByToken).not.toHaveBeenCalled();
      expect(location(response)).toContain("error=sso_recovery_link_not_opened");
    });
  });

  test("refuses a body that is not form data", async () => {
    const response = await POST(
      new Request(`${WEBAPP_URL}/api/auth/sso/recovery/complete`, {
        method: "POST",
        headers: { "content-type": "application/json", ...CLICKED_FORM },
        body: JSON.stringify({ state: "state-id" }),
      })
    );

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  test("refuses a submission with no state", async () => {
    const response = await POST(
      new Request(`${WEBAPP_URL}/api/auth/sso/recovery/complete`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", ...CLICKED_FORM },
        body: "",
      })
    );

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  test("sends the user on to the callback the completed recovery returns", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(`${WEBAPP_URL}/environments/env_1`);

    const response = await POST(submit("state-id"));

    expect(completeSsoRecovery).toHaveBeenCalledWith(
      expect.objectContaining({ stateId: "state-id", sessionUserId: "user_1" })
    );
    expect(location(response)).toBe(`${WEBAPP_URL}/environments/env_1`);
  });

  test("hands the session token through, so the post-commit sweep can spare it", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(WEBAPP_URL);

    await POST(submit("state-id", "formbricks.session_token=token-abc.signature"));

    // The exact value, not just "some token": forwarding the wrong one would still be defined.
    expect(vi.mocked(completeSsoRecovery).mock.calls[0][0].sessionToken).toBe("token-abc");
  });

  test("hands the recovery proof cookie through to the completion (ENG-7310)", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(WEBAPP_URL);

    await POST(
      submit(
        "state-id",
        `formbricks.session_token=token-abc.signature; ${SSO_RECOVERY_PROOF_COOKIE_NAME}=proof-value`
      )
    );

    expect(vi.mocked(completeSsoRecovery).mock.calls[0][0].recoveryProof).toBe("proof-value");
  });

  test("passes no proof when the browser holds none", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(WEBAPP_URL);

    await POST(submit("state-id", "formbricks.session_token=token-abc.signature"));

    expect(vi.mocked(completeSsoRecovery).mock.calls[0][0].recoveryProof).toBeUndefined();
  });

  test("clears the spent proof cookie once recovery completes", async () => {
    vi.mocked(completeSsoRecovery).mockResolvedValue(WEBAPP_URL);

    const response = await POST(submit("state-id", `${SSO_RECOVERY_PROOF_COOKIE_NAME}=p`));

    expect(response.headers.getSetCookie().join("\n")).toMatch(
      new RegExp(`${SSO_RECOVERY_PROOF_COOKIE_NAME}=;.*Max-Age=0`)
    );
  });

  /**
   * A browser that never opened the emailed link (ENG-7310). Its session was not minted by the link, and
   * anyone holding a state id can send the account holder's browser here, so revoking it would turn the
   * URL into a sign-out link.
   */
  test("leaves the session alone when this browser never opened the emailed link", async () => {
    // Carrying a callback on purpose: the route must drop it, or the redirect tells whoever holds a state
    // id where the account holder was headed.
    vi.mocked(completeSsoRecovery).mockRejectedValue(
      new SsoRecoveryError("unproven", `${WEBAPP_URL}/environments/secret`)
    );

    const response = await POST(submit("state-id", "formbricks.session_token=token-abc.signature"));

    expect(revokeSessionByToken).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie().join("\n")).not.toContain("session_token=;");
    // Its own code, so the login page says to open the emailed link (or ignore it), not "try again".
    expect(location(response)).toContain("error=sso_recovery_link_not_opened");
    expect(location(response)).not.toContain("callbackUrl=");
  });

  test("redirects to the failure page when no state is present", async () => {
    const response = await GET(request(`${WEBAPP_URL}/api/auth/sso/recovery/complete`));

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  /**
   * The parameter changed from a JWT payload to an opaque reference. A stale `?intent=` link — one
   * emailed before the deploy, still inside its window — must land on the ordinary failure page rather
   * than being treated as a state id.
   */
  test("does not accept the old intent parameter", async () => {
    const response = await GET(request(`${WEBAPP_URL}/api/auth/sso/recovery/complete?intent=some.jwt.value`));

    expect(completeSsoRecovery).not.toHaveBeenCalled();
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  test("carries the intent's own callback into the failure redirect", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(
      new SsoRecoveryError("rejected", `${WEBAPP_URL}/environments/env_1`)
    );

    const response = await POST(submit("state-id"));

    expect(location(response)).toContain(
      `callbackUrl=${encodeURIComponent(`${WEBAPP_URL}/environments/env_1`)}`
    );
  });

  test("omits the callback when the intent could not be read at all", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(new SsoRecoveryError("intent_unusable"));

    const response = await POST(submit("unknown"));

    expect(location(response)).toContain("error=OAuthAccountNotLinked");
    expect(location(response)).not.toContain("callbackUrl=");
  });

  /**
   * The emailed link is replayable for its whole window by design, so a second open — the other
   * device, or a
   * refresh — is an ordinary act. It finds the intent already consumed, and that is not evidence of a
   * session that should not exist: tearing one down here signed the user in and then straight back out,
   * reporting that the linking had failed after it had already succeeded.
   */
  test("leaves the session alone when the intent is simply gone", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(new SsoRecoveryError("intent_unusable"));

    const response = await POST(submit("state-id", "formbricks.session_token=token-abc.signature"));

    expect(revokeSessionByToken).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie().join("\n")).not.toContain("session_token=;");
    expect(location(response)).toContain("error=OAuthAccountNotLinked");
  });

  test("still redirects safely when the failure is not one of ours", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(new Error("redis exploded"));

    const response = await POST(submit("state-id"));

    expect(location(response)).toContain("error=OAuthAccountNotLinked");
    expect(location(response)).not.toContain("callbackUrl=");
    // Not one of ours, so nothing upstream logged it.
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: "Error" }),
      "Unexpected error completing SSO recovery"
    );
    // Through loggableError: never the message, which can carry what the request held.
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("redis exploded");
  });

  test("clears the session cookies and revokes the session it was given on a rejected recovery", async () => {
    vi.mocked(completeSsoRecovery).mockRejectedValue(new SsoRecoveryError("rejected"));

    const response = await POST(submit("state-id", "formbricks.session_token=token-abc.signature"));

    const setCookies = response.headers.getSetCookie().join("\n");
    expect(setCookies).toContain("formbricks.session_token=;");
    expect(setCookies).toContain("__Secure-formbricks.session_token=;");
    expect(revokeSessionByToken).toHaveBeenCalled();
  });
});
