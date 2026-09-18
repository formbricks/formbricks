import * as cuid2 from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import * as crypto from "@/lib/crypto";
import { env } from "@/lib/env";
import {
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

  describe("minting", () => {
    // `generateSurveySingleUseId` is module-private since ENG-2758 -- it mints an id with no survey
    // binding, which is the shape the vulnerability had. Its behaviour is covered here through the
    // public entry point that always signs.
    beforeEach(() => {
      vi.mocked(env).ENCRYPTION_KEY = "test-encryption-key";
    });

    test("returns a plain cuid as the suId when encryption is disabled", () => {
      vi.spyOn(cuid2, "createId").mockReturnValueOnce("test-cuid");

      expect(generateSurveySingleUseLinkParams("survey-1", false).suId).toBe("test-cuid");
      expect(crypto.symmetricEncrypt).not.toHaveBeenCalled();
    });

    test("returns an encrypted cuid as the suId when encryption is enabled", () => {
      vi.spyOn(cuid2, "createId").mockReturnValueOnce("test-cuid");
      vi.mocked(crypto.symmetricEncrypt).mockReturnValueOnce("encrypted-test-cuid");

      expect(generateSurveySingleUseLinkParams("survey-1", true).suId).toBe("encrypted-test-cuid");
      expect(crypto.symmetricEncrypt).toHaveBeenCalledWith("test-cuid", env.ENCRYPTION_KEY);
    });

    test("prefers a supplied custom id over a generated one, in plaintext mode", () => {
      expect(generateSurveySingleUseLinkParams("survey-1", false, "CUSTOM-ID").suId).toBe("CUSTOM-ID");
    });

    test.each([true, false])("throws when the encryption key is missing (isEncrypted=%s)", (isEncrypted) => {
      vi.mocked(env).ENCRYPTION_KEY = "";
      vi.spyOn(cuid2, "createId").mockReturnValueOnce("test-cuid");

      expect(() => generateSurveySingleUseLinkParams("survey-1", isEncrypted)).toThrow(
        "ENCRYPTION_KEY is not set"
      );

      vi.mocked(env).ENCRYPTION_KEY = "test-encryption-key";
    });

    test("signs every link in a bulk batch", () => {
      const batch = generateSurveySingleUseLinkParamsList(3, "survey-1", false);

      expect(batch).toHaveLength(3);
      expect(batch.every((params) => /^[0-9a-f]{64}$/.test(params.suToken))).toBe(true);
    });

    test("returns an empty batch when count is zero", () => {
      expect(generateSurveySingleUseLinkParamsList(0, "survey-1", false)).toEqual([]);
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
    // Colon-joined, like the real `symmetricEncrypt` (`iv:ciphertext:tag`, and `iv:ciphertext` on the
    // legacy CBC layout). The separator is not decoration: a cuid2 cannot contain one, which is how
    // plaintext mode tells an ordinary single-use id from a ciphertext without trusting a decrypt
    // implementation to throw. A fake without it would exercise a shape production never produces.
    const fakeEncrypt = (plaintext: string) => `iv:enc(${plaintext}):tag`;
    const fakeDecrypt = (ciphertext: string) => {
      const match = /^iv:enc\((.*)\):tag$/.exec(ciphertext);
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

    /**
     * Toggling encryption is a supported share-modal action, and the signature does not record which
     * mode a link was minted in. Without the plaintext-mode refusal the same physical link resolves to
     * the ciphertext in one mode and to the cuid inside it in the other — two single-use identities for
     * one link, so a response stored under the first is invisible to the lookup for the second and the
     * survey reopens. Raised in review on #9131.
     */
    describe("a link minted in encrypted mode, presented after encryption is turned off", () => {
      const openInPlaintextMode = (suId: string, suToken: string) =>
        validateSurveySingleUseLinkParams({
          surveyId: SURVEY_A,
          suId,
          suToken,
          isEncrypted: false,
          decrypt: fakeDecrypt,
        });

      test("is refused, rather than canonicalized to its own ciphertext", () => {
        const minted = mintForA();

        expect(openInPlaintextMode(minted.suId, minted.suToken)).toEqual({
          ok: false,
          reason: "encrypted_id_in_plaintext_mode",
        });
      });

      test("and the two modes can no longer disagree about its identity", () => {
        const minted = mintForA();

        const inEncryptedMode = presentTo(SURVEY_A, minted);
        expect(inEncryptedMode).toEqual({ ok: true, singleUseId: PLAIN_CUID });
        // The only other outcome the resolver can now reach for this link is a refusal, so there is no
        // second identity for a response to be stored under.
        expect(openInPlaintextMode(minted.suId, minted.suToken).ok).toBe(false);
      });

      test("a genuine plaintext link still opens in plaintext mode", () => {
        // The control. A refusal that also rejected ordinary plaintext links would be an outage, and
        // every assertion above would still pass.
        const plaintext = generateSurveySingleUseLinkParams(SURVEY_A, false);

        expect(openInPlaintextMode(plaintext.suId, plaintext.suToken)).toEqual({
          ok: true,
          singleUseId: PLAIN_CUID,
        });
      });

      test("and the mirror case — a plaintext link after encryption is turned on — is refused too", () => {
        // The other half of the same toggle, and the half that was already safe: a bare cuid has no
        // colons, so `symmetricDecrypt` refuses it outright rather than yielding a second identity.
        // Asserted so the asymmetry between the two directions is a decision on the record, not an
        // accident of the cipher's input format.
        const plaintext = generateSurveySingleUseLinkParams(SURVEY_A, false);

        expect(presentTo(SURVEY_A, plaintext)).toEqual({ ok: false, reason: "decryption_failed" });
      });

      test("a plaintext id is never handed to the cipher at all", () => {
        // The refusal must rest on the value's shape, not on the decrypt throwing. A caller-supplied
        // stub that returns a cuid for anything — which is exactly what the v1 gate's suite mocks —
        // would otherwise turn every ordinary plaintext link into a refusal.
        const plaintext = generateSurveySingleUseLinkParams(SURVEY_A, false);
        const permissiveDecrypt = vi.fn(() => PLAIN_CUID);

        expect(
          validateSurveySingleUseLinkParams({
            surveyId: SURVEY_A,
            suId: plaintext.suId,
            suToken: plaintext.suToken,
            isEncrypted: false,
            decrypt: permissiveDecrypt,
          })
        ).toEqual({ ok: true, singleUseId: PLAIN_CUID });
        expect(permissiveDecrypt).not.toHaveBeenCalled();
      });

      test("an operator's custom id that is not a ciphertext still opens", () => {
        // Custom ids are plaintext-only and operator-chosen, so they must survive the decrypt probe.
        const custom = generateSurveySingleUseLinkParams(SURVEY_A, false, "ORDER-12345");

        expect(openInPlaintextMode(custom.suId, custom.suToken)).toEqual({
          ok: true,
          singleUseId: "ORDER-12345",
        });
      });
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
