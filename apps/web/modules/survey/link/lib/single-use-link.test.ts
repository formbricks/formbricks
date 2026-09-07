import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricEncrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { generateSurveySingleUseLinkParams } from "@/lib/utils/single-use-surveys";
import { resolveSingleUseIdForSurvey } from "./single-use-link";

// 64 hex characters -> exactly 32 bytes once decoded.
const { KEY } = vi.hoisted(() => ({ KEY: "0123456789abcdef".repeat(4) }));

vi.mock("server-only", () => ({}));

// vitestSetup.ts globally stubs createHash to return the literal "fake-hash", which would make the
// token-fingerprint assertions below pass without hashing anything. A file-level registration wins
// over the setup file; everything else in node:crypto is already real.
vi.mock(
  "node:crypto",
  async (importOriginal: () => Promise<typeof import("node:crypto")>) => await importOriginal()
);

/**
 * Both key sources are pinned to one value, and that is load-bearing rather than tidiness.
 *
 * `@/lib/crypto` fixes BUFFER_ENCODING at module load from `@/lib/constants.ENCRYPTION_KEY.length`,
 * while `lib/utils/single-use-surveys.ts` takes its key from `@/lib/env`. vitestSetup.ts globally
 * overrides only the former, to "mock-encryption-key" (19 chars). Leaving `@/lib/env` ambient would
 * encrypt under whatever the developer's .env holds -- and setup-dev-env.sh accepts a 32-RAW-char
 * key, for which Buffer.from(key, "hex") is not 32 bytes. Every encrypt would throw, the resolver
 * would return null, and every "rejected" assertion below would pass while proving nothing.
 */
vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: KEY } }));
vi.mock("@/lib/constants", async (importOriginal: () => Promise<typeof import("@/lib/constants")>) => ({
  ...(await importOriginal()),
  ENCRYPTION_KEY: KEY,
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

const SURVEY_A = "cm0aaaaaaaaaaaaaaaaaaaaa1"; // the attacker's own survey
const SURVEY_B = "cm0bbbbbbbbbbbbbbbbbbbbb2"; // the victim's survey, another organisation on Cloud

const openOn = (surveyId: string, suId?: string | null, suToken?: string | null) =>
  resolveSingleUseIdForSurvey({ surveyId, isEncrypted: true, suId, suToken, surface: "link_page" });

describe("resolveSingleUseIdForSurvey (ENG-2758)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("the harness is keyed consistently, so no rejection below can be vacuous", () => {
    expect(ENCRYPTION_KEY).toBe(env.ENCRYPTION_KEY);
    // A real AES-256-GCM round trip under that one key. If this fails, every other test in this file
    // is passing for the wrong reason.
    expect(generateSurveySingleUseLinkParams(SURVEY_A, true).suId).toMatch(
      /^[0-9a-f]{32}:[0-9a-f]+:[0-9a-f]{32}$/
    );
  });

  test("accepts its own survey's link and returns the plaintext CUID", () => {
    const minted = generateSurveySingleUseLinkParams(SURVEY_A, true);

    expect(openOn(SURVEY_A, minted.suId, minted.suToken)).toMatch(/^[a-z0-9]{24}$/);
  });

  test("refuses to open survey A's link on survey B, in every shape the attacker controls", () => {
    const minted = generateSurveySingleUseLinkParams(SURVEY_A, true);
    const leaked = openOn(SURVEY_A, minted.suId, minted.suToken);
    expect(leaked).not.toBeNull();

    expect(openOn(SURVEY_B, minted.suId, minted.suToken)).toBeNull();
    expect(openOn(SURVEY_B, minted.suId)).toBeNull();
    expect(openOn(SURVEY_B, minted.suId, "")).toBeNull();
    // The plaintext CUID is known to the attacker from their own survey. It is not a token.
    expect(openOn(SURVEY_B, minted.suId, leaked)).toBeNull();
  });

  test("refuses a ciphertext this deployment minted for something that is not a single-use id", () => {
    // The cheap attack, and the one isCuid() structurally cannot catch. getContactSurveyLink
    // encrypts a contactId -- itself a cuid2 -- and puts the ciphertext in the HS256 JWT payload of
    // a /c/{jwt} personalized link, which is base64url, not encrypted. Anyone holding one such link
    // can lift that value and present it as ?suId=. It decrypts cleanly and is a valid cuid2; only
    // the missing MAC distinguishes it from a real single-use id.
    const encryptedContactId = symmetricEncrypt(createId(), ENCRYPTION_KEY);

    expect(openOn(SURVEY_A, encryptedContactId)).toBeNull();
    expect(openOn(SURVEY_B, encryptedContactId)).toBeNull();
  });

  test("does not regress plaintext mode through the unified path", () => {
    const minted = generateSurveySingleUseLinkParams(SURVEY_A, false);
    const open = (surveyId: string) =>
      resolveSingleUseIdForSurvey({
        surveyId,
        isEncrypted: false,
        suId: minted.suId,
        suToken: minted.suToken,
        surface: "link_page",
      });

    expect(open(SURVEY_A)).toBe(minted.suId);
    expect(open(SURVEY_B)).toBeNull();
  });

  test("rejects a suId this deployment's key cannot open, but only behind a valid token", () => {
    const suId = "not-a-ciphertext";
    const { suToken } = generateSurveySingleUseLinkParams(SURVEY_A, true);

    expect(openOn(SURVEY_A, suId, suToken)).toBeNull();
    expect(openOn(SURVEY_A, null)).toBeNull();
  });

  describe("observability", () => {
    test("records a rejected link at warn, never at error", () => {
      // The link page and both response endpoints are public and unauthenticated. At error level,
      // any anonymous caller gets a lever to flood alerting and Sentry ingestion.
      const minted = generateSurveySingleUseLinkParams(SURVEY_A, true);

      expect(openOn(SURVEY_B, minted.suId, minted.suToken)).toBeNull();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).not.toHaveBeenCalled();
    });

    test("never logs the suId, the suToken or the decrypted CUID", () => {
      // A single-use id is a live credential: the response endpoints require exactly that value in
      // the request body, so logging it turns log access into response forgery.
      const minted = generateSurveySingleUseLinkParams(SURVEY_A, true);
      const decrypted = openOn(SURVEY_A, minted.suId, minted.suToken);
      vi.mocked(logger.warn).mockClear();

      expect(openOn(SURVEY_B, minted.suId, minted.suToken)).toBeNull();

      const logged = JSON.stringify(vi.mocked(logger.warn).mock.calls);
      expect(logged).toContain(SURVEY_B);
      expect(logged).toContain("signature_mismatch");
      expect(logged).not.toContain(minted.suId);
      expect(logged).not.toContain(minted.suToken);
      expect(logged).not.toContain(decrypted);
    });

    test("carries a token fingerprint only when a token was actually presented", () => {
      const minted = generateSurveySingleUseLinkParams(SURVEY_A, true);

      openOn(SURVEY_B, minted.suId, minted.suToken);
      expect(vi.mocked(logger.warn).mock.calls[0][0]).toMatchObject({
        reason: "signature_mismatch",
        suTokenFingerprint: expect.stringMatching(/^[0-9a-f]{12}$/),
      });

      vi.mocked(logger.warn).mockClear();

      // No token to fingerprint -- and its absence is the signal that separates a link minted before
      // this release from a forgery.
      openOn(SURVEY_B, minted.suId);
      expect(vi.mocked(logger.warn).mock.calls[0][0]).toMatchObject({ reason: "missing_signature" });
      expect(vi.mocked(logger.warn).mock.calls[0][0]).not.toHaveProperty("suTokenFingerprint");
    });
  });
});
