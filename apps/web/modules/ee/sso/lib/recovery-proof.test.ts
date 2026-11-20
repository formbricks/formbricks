import { describe, expect, test, vi } from "vitest";
import {
  createSsoRecoveryProof,
  getSsoRecoveryStateIdFromCompletionUrl,
  isValidSsoRecoveryProof,
} from "./recovery-proof";

const secret = vi.hoisted(() => ({ value: "test-auth-secret" as string | undefined }));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get AUTH_SECRET() {
    return secret.value;
  },
}));

const WEBAPP_URL = "http://localhost:3000";

describe("SSO recovery proof (ENG-7310)", () => {
  test("accepts the proof minted for the same user and recovery", () => {
    const proof = createSsoRecoveryProof("user_1", "state-1");

    expect(isValidSsoRecoveryProof(proof, "user_1", "state-1")).toBe(true);
  });

  test("is deterministic, so a replayed link mints the same proof", () => {
    expect(createSsoRecoveryProof("user_1", "state-1")).toBe(createSsoRecoveryProof("user_1", "state-1"));
  });

  test.each([
    ["another user", "user_2", "state-1"],
    ["another recovery", "user_1", "state-2"],
  ])("rejects a proof checked against %s", (_label, userId, stateId) => {
    expect(isValidSsoRecoveryProof(createSsoRecoveryProof("user_1", "state-1"), userId, stateId)).toBe(false);
  });

  test("keeps the user and state apart, so neither can absorb part of the other", () => {
    // Concatenated without a separator, `user_1` + `a` and `user_` + `1a` would be the same input.
    expect(isValidSsoRecoveryProof(createSsoRecoveryProof("user_1", "a"), "user_", "1a")).toBe(false);
  });

  test.each([
    ["absent", undefined],
    ["empty", ""],
    ["truncated", createSsoRecoveryProof("user_1", "state-1").slice(0, -1)],
    ["extended", `${createSsoRecoveryProof("user_1", "state-1")}A`],
  ])("rejects an %s proof without throwing", (_label, proof) => {
    expect(isValidSsoRecoveryProof(proof, "user_1", "state-1")).toBe(false);
  });

  test("depends on the auth secret", () => {
    const proof = createSsoRecoveryProof("user_1", "state-1");
    secret.value = "rotated-secret";
    try {
      expect(isValidSsoRecoveryProof(proof, "user_1", "state-1")).toBe(false);
    } finally {
      secret.value = "test-auth-secret";
    }
  });

  test("fails closed when no auth secret is configured", () => {
    const proof = createSsoRecoveryProof("user_1", "state-1");
    secret.value = undefined;
    try {
      expect(isValidSsoRecoveryProof(proof, "user_1", "state-1")).toBe(false);
      expect(() => createSsoRecoveryProof("user_1", "state-1")).toThrow("No auth secret set");
    } finally {
      secret.value = "test-auth-secret";
    }
  });
});

describe("getSsoRecoveryStateIdFromCompletionUrl", () => {
  test("reads the state from a completion URL", () => {
    expect(
      getSsoRecoveryStateIdFromCompletionUrl(
        `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=abc`,
        WEBAPP_URL
      )
    ).toBe("abc");
  });

  test("normalizes the path the way the router does", () => {
    expect(
      getSsoRecoveryStateIdFromCompletionUrl(
        `${WEBAPP_URL}/api//auth/sso/recovery///complete?state=abc`,
        WEBAPP_URL
      )
    ).toBe("abc");
  });

  test.each([
    ["no callback", undefined],
    ["another path", `${WEBAPP_URL}/environments/env_1?state=abc`],
    ["another origin", "https://evil.example/api/auth/sso/recovery/complete?state=abc"],
    ["no state", `${WEBAPP_URL}/api/auth/sso/recovery/complete`],
    ["an empty state", `${WEBAPP_URL}/api/auth/sso/recovery/complete?state=`],
  ])("returns null for %s", (_label, callbackUrl) => {
    expect(getSsoRecoveryStateIdFromCompletionUrl(callbackUrl, WEBAPP_URL)).toBeNull();
  });
});

describe("SSO_RECOVERY_PROOF_COOKIE_NAME", () => {
  /**
   * `__Host-` on HTTPS, so a sibling subdomain cannot plant a cookie under this name: the prefix forbids
   * a `Domain` attribute, and requires `Secure` and `Path=/`, which the options must then carry.
   */
  test("takes the __Host- prefix when cookies are secure, with the attributes it requires", async () => {
    vi.resetModules();
    vi.doMock("@/modules/auth/lib/auth-cookies", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/modules/auth/lib/auth-cookies")>()),
      USE_SECURE_COOKIES: true,
    }));
    try {
      const { SSO_RECOVERY_PROOF_COOKIE_NAME, SSO_RECOVERY_PROOF_COOKIE_OPTIONS } =
        await import("./recovery-proof");

      expect(SSO_RECOVERY_PROOF_COOKIE_NAME).toBe("__Host-formbricks.sso_recovery_proof");
      // Exactly these attributes: a `domain` (or any other) added later would break the prefix's rule.
      expect(SSO_RECOVERY_PROOF_COOKIE_OPTIONS).toEqual({
        httpOnly: true,
        secure: true,
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 15,
      });
    } finally {
      vi.doUnmock("@/modules/auth/lib/auth-cookies");
      vi.resetModules();
    }
  });
});
