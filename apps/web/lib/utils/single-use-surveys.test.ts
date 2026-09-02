import * as cuid2 from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import * as crypto from "@/lib/crypto";
import { env } from "@/lib/env";
import {
  generateSurveySingleUseId,
  generateSurveySingleUseIds,
  generateSurveySingleUseLinkParams,
  generateSurveySingleUseLinkParamsList,
  generateSurveySingleUseSignature,
  validateSurveySingleUseLinkParams,
  validateSurveySingleUseSignature,
} from "./single-use-surveys";

// Stub only the two functions these tests assert on. `constantTimeEqual` stays real — signature
// validation is the behavior under test here, and a stub would make it pass without comparing anything.
vi.mock("@/lib/crypto", async (importOriginal: () => Promise<typeof import("@/lib/crypto")>) => ({
  ...(await importOriginal()),
  symmetricEncrypt: vi.fn(),
  symmetricDecrypt: vi.fn(),
}));

vi.mock(
  "@paralleldrive/cuid2",
  async (importOriginal: () => Promise<typeof import("@paralleldrive/cuid2")>) => {
    const original = await importOriginal();
    return {
      ...original,
      createId: vi.fn(),
      isCuid: vi.fn(),
    };
  }
);

vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: "test-encryption-key",
  },
}));

describe("Single Use Surveys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSurveySingleUseId", () => {
    test("returns plain cuid when encryption is disabled", () => {
      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock.mockReturnValueOnce("test-cuid");

      const result = generateSurveySingleUseId(false);

      expect(result).toBe("test-cuid");
      expect(createIdMock).toHaveBeenCalledTimes(1);
      expect(crypto.symmetricEncrypt).not.toHaveBeenCalled();
    });

    test("returns encrypted cuid when encryption is enabled", () => {
      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock.mockReturnValueOnce("test-cuid");
      vi.mocked(crypto.symmetricEncrypt).mockReturnValueOnce("encrypted-test-cuid");

      const result = generateSurveySingleUseId(true);

      expect(result).toBe("encrypted-test-cuid");
      expect(createIdMock).toHaveBeenCalledTimes(1);
      expect(crypto.symmetricEncrypt).toHaveBeenCalledWith("test-cuid", env.ENCRYPTION_KEY);
    });

    test("throws error when encryption key is missing", () => {
      vi.mocked(env).ENCRYPTION_KEY = "";
      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock.mockReturnValueOnce("test-cuid");

      expect(() => generateSurveySingleUseId(true)).toThrow("ENCRYPTION_KEY is not set");

      // Restore encryption key for subsequent tests
      vi.mocked(env).ENCRYPTION_KEY = "test-encryption-key";
    });
  });

  describe("generateSurveySingleUseIds", () => {
    beforeEach(() => {
      vi.mocked(env).ENCRYPTION_KEY = "test-encryption-key";
    });

    test("generates multiple single use IDs", () => {
      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock
        .mockReturnValueOnce("test-cuid-1")
        .mockReturnValueOnce("test-cuid-2")
        .mockReturnValueOnce("test-cuid-3");

      const result = generateSurveySingleUseIds(3, false);

      expect(result).toEqual(["test-cuid-1", "test-cuid-2", "test-cuid-3"]);
      expect(createIdMock).toHaveBeenCalledTimes(3);
    });

    test("generates encrypted IDs when encryption is enabled", () => {
      const createIdMock = vi.spyOn(cuid2, "createId");

      createIdMock.mockReturnValueOnce("test-cuid-1").mockReturnValueOnce("test-cuid-2");

      vi.mocked(crypto.symmetricEncrypt)
        .mockReturnValueOnce("encrypted-test-cuid-1")
        .mockReturnValueOnce("encrypted-test-cuid-2");

      const result = generateSurveySingleUseIds(2, true);

      expect(result).toEqual(["encrypted-test-cuid-1", "encrypted-test-cuid-2"]);
      expect(createIdMock).toHaveBeenCalledTimes(2);
      expect(crypto.symmetricEncrypt).toHaveBeenCalledTimes(2);
    });

    test("returns empty array when count is zero", () => {
      const result = generateSurveySingleUseIds(0, false);

      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock.mockReturnValueOnce("test-cuid");

      expect(result).toEqual([]);
      expect(createIdMock).not.toHaveBeenCalled();
    });
  });

  describe("signed single-use links", () => {
    beforeEach(() => {
      vi.mocked(env).ENCRYPTION_KEY = "test-encryption-key";
    });

    test("generates and validates signed custom single-use IDs", () => {
      const params = generateSurveySingleUseLinkParams("survey-1", false, "CUSTOM-ID");

      expect(params.suId).toBe("CUSTOM-ID");
      expect(params.suToken).toBeDefined();
      expect(validateSurveySingleUseSignature("survey-1", params.suId, params.suToken)).toBe(true);
      expect(
        validateSurveySingleUseLinkParams({
          surveyId: "survey-1",
          suId: params.suId,
          suToken: params.suToken,
          isEncrypted: false,
          decrypt: vi.fn(),
        })
      ).toEqual({ ok: true, singleUseId: "CUSTOM-ID" });
    });

    test("rejects tampered signed custom single-use IDs", () => {
      const params = generateSurveySingleUseLinkParams("survey-1", false, "CUSTOM-ID");

      expect(validateSurveySingleUseSignature("survey-2", params.suId, params.suToken)).toBe(false);
      expect(validateSurveySingleUseSignature("survey-1", "OTHER-ID", params.suToken)).toBe(false);
      expect(validateSurveySingleUseSignature("survey-1", params.suId, "invalid-token")).toBe(false);
      expect(validateSurveySingleUseSignature("survey-1", params.suId)).toBe(false);
    });
  });

  describe("validateSurveySingleUseLinkParams", () => {
    test("rejects an encrypted single-use ID that carries no binding token", () => {
      // Inverted for ENG-2758. This test used to assert that an unsigned encrypted suId returned its
      // decrypted CUID -- which was the vulnerability itself, since nothing tied the ciphertext to
      // any survey.
      const decrypt = vi.fn().mockReturnValue("decrypted-cuid");

      const result = validateSurveySingleUseLinkParams({
        surveyId: "survey-1",
        suId: "encrypted-cuid",
        isEncrypted: true,
        decrypt,
      });

      expect(result).toEqual({ ok: false, reason: "missing_signature" });
      expect(decrypt).not.toHaveBeenCalled();
    });

    test("returns the decrypted CUID for a correctly signed encrypted single-use ID", () => {
      const decrypt = vi.fn().mockReturnValue("decrypted-cuid");
      vi.mocked(cuid2.isCuid).mockReturnValueOnce(true);

      const result = validateSurveySingleUseLinkParams({
        surveyId: "survey-1",
        suId: "encrypted-cuid",
        suToken: generateSurveySingleUseSignature("survey-1", "encrypted-cuid"),
        isEncrypted: true,
        decrypt,
      });

      expect(result).toEqual({ ok: true, singleUseId: "decrypted-cuid" });
      expect(decrypt).toHaveBeenCalledWith("encrypted-cuid");
      expect(cuid2.isCuid).toHaveBeenCalledWith("decrypted-cuid");
    });

    test("rejects encrypted single-use IDs that decrypt to invalid CUIDs", () => {
      const decrypt = vi.fn().mockReturnValue("invalid-id");
      vi.mocked(cuid2.isCuid).mockReturnValueOnce(false);

      const result = validateSurveySingleUseLinkParams({
        surveyId: "survey-1",
        suId: "encrypted-cuid",
        // Signed, so validation reaches the shape check instead of short-circuiting at the token.
        suToken: generateSurveySingleUseSignature("survey-1", "encrypted-cuid"),
        isEncrypted: true,
        decrypt,
      });

      expect(result).toEqual({ ok: false, reason: "not_a_cuid" });
      expect(decrypt).toHaveBeenCalledWith("encrypted-cuid");
      expect(cuid2.isCuid).toHaveBeenCalledWith("invalid-id");
    });

    test("rejects encrypted single-use IDs when decryption fails", () => {
      const decrypt = vi.fn(() => {
        throw new Error("Invalid encrypted payload");
      });

      const result = validateSurveySingleUseLinkParams({
        surveyId: "survey-1",
        suId: "malformed-encrypted-cuid",
        suToken: generateSurveySingleUseSignature("survey-1", "malformed-encrypted-cuid"),
        isEncrypted: true,
        decrypt,
      });

      expect(result).toEqual({ ok: false, reason: "decryption_failed" });
      expect(decrypt).toHaveBeenCalledWith("malformed-encrypted-cuid");
      expect(cuid2.isCuid).not.toHaveBeenCalled();
    });
  });

  describe("encrypted single-use links are bound to their survey (ENG-2758)", () => {
    // Two surveys that, on Formbricks Cloud, would belong to two different organisations: one
    // deployment, one ENCRYPTION_KEY, every tenant.
    const SURVEY_A = "cm0aaaaaaaaaaaaaaaaaaaaa1"; // the attacker's own survey
    const SURVEY_B = "cm0bbbbbbbbbbbbbbbbbbbbb2"; // the victim's survey
    const PLAIN_CUID = "cm8f4x9mm0001gx9h5b7d7h3q";

    // A reversible stand-in for AES. What binds a link to its survey is the HMAC, and `decrypt` is
    // injected here, so the cheapest level that can fail on this bug needs no cipher at all. The
    // round trip against real AES-256-GCM and a real deployment key is proven separately in
    // modules/survey/link/lib/single-use-link.test.ts.
    const fakeEncrypt = (plaintext: string) => `enc(${plaintext})`;
    const fakeDecrypt = (ciphertext: string) => {
      const match = /^enc\((.*)\)$/.exec(ciphertext);
      if (!match) throw new Error("Invalid encrypted payload");
      return match[1];
    };

    beforeEach(() => {
      vi.mocked(env).ENCRYPTION_KEY = "test-encryption-key";
      vi.mocked(cuid2.createId).mockReturnValue(PLAIN_CUID);
      vi.mocked(cuid2.isCuid).mockImplementation((value: string) => value === PLAIN_CUID);
      vi.mocked(crypto.symmetricEncrypt).mockImplementation(fakeEncrypt);
    });

    const mintForA = () => generateSurveySingleUseLinkParams(SURVEY_A, true);

    const presentTo = (
      surveyId: string,
      params: { suId: string; suToken?: string },
      decrypt: (value: string) => string = fakeDecrypt
    ) =>
      validateSurveySingleUseLinkParams({
        surveyId,
        suId: params.suId,
        suToken: params.suToken,
        isEncrypted: true,
        decrypt,
      });

    test("mints a binding token, as plaintext mode already did", () => {
      expect(mintForA().suToken).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
    });

    test("every link in a bulk batch carries one", () => {
      // The contract the management endpoint's own comment already claimed.
      const batch = generateSurveySingleUseLinkParamsList(3, SURVEY_A, true);

      expect(batch).toHaveLength(3);
      expect(batch.every((params) => /^[0-9a-f]{64}$/.test(params.suToken))).toBe(true);
    });

    test("a link minted for survey A is rejected when presented to survey B", () => {
      const minted = mintForA();

      // Control: its own survey accepts it and yields the plaintext CUID.
      expect(presentTo(SURVEY_A, minted)).toEqual({ ok: true, singleUseId: PLAIN_CUID });

      // The bug: survey B used to accept this and hand back that same plaintext CUID -- the value
      // both response endpoints then require in the request body.
      expect(presentTo(SURVEY_B, minted)).toEqual({ ok: false, reason: "signature_mismatch" });
    });

    test("rejects an encrypted link with no binding token at all", () => {
      expect(presentTo(SURVEY_A, { suId: mintForA().suId })).toEqual({
        ok: false,
        reason: "missing_signature",
      });
    });

    test("rejects a token minted for another survey, and one minted for another ciphertext", () => {
      const minted = mintForA();

      expect(
        presentTo(SURVEY_A, {
          suId: minted.suId,
          suToken: generateSurveySingleUseSignature(SURVEY_B, minted.suId),
        })
      ).toEqual({ ok: false, reason: "signature_mismatch" });

      expect(
        presentTo(SURVEY_A, { suId: fakeEncrypt("cm0other0000000000000000x"), suToken: minted.suToken })
      ).toEqual({ ok: false, reason: "signature_mismatch" });
    });

    test("never decrypts a suId whose token it has not accepted", () => {
      // The ordering is the behaviour, not an implementation detail. `symmetricDecrypt` routes a
      // two-part payload to unauthenticated AES-256-CBC, and running any cipher over attacker-chosen
      // input is what made the victim's link page a decryption oracle.
      const decrypt = vi.fn(fakeDecrypt);

      expect(presentTo(SURVEY_B, mintForA(), decrypt)).toEqual({
        ok: false,
        reason: "signature_mismatch",
      });
      expect(decrypt).not.toHaveBeenCalled();
    });
  });
});
