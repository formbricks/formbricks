import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { symmetricDecrypt } from "@/lib/crypto";
import { generateSurveySingleUseSignature } from "@/lib/utils/single-use-surveys";
import { validateSingleUseResponseInput } from "./single-use";

vi.mock("server-only", () => ({}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    badRequestResponse: vi.fn((message: string) => new Response(message, { status: 400 })),
    internalServerErrorResponse: vi.fn((message: string) => new Response(message, { status: 500 })),
  },
}));

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

// Stub only symmetricDecrypt. The rest of @/lib/crypto stays real because the survey binding runs
// through the real createHmac and constantTimeEqual -- stubbing those would accept anything.
vi.mock("@/lib/crypto", async (importOriginal: () => Promise<typeof import("@/lib/crypto")>) => ({
  ...(await importOriginal()),
  symmetricDecrypt: vi.fn(),
}));

// One key in both sources: @/lib/crypto reads @/lib/constants at module load, while
// lib/utils/single-use-surveys reads @/lib/env. Two different strings would key the HMAC this file
// mints differently from the one the gate computes, and every rejection below would be vacuous.
// Mutable so the ENCRYPTION_KEY-missing branch is reachable; it must be a valid string at module
// load or crypto.ts throws on `.length`.
const mocks = vi.hoisted(() => ({ constants: { ENCRYPTION_KEY: "test-key" as string | undefined } }));
vi.mock("@/lib/constants", () => mocks.constants);
vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: "test-key" } }));

const SURVEY_ID = "cm0aaaaaaaaaaaaaaaaaaaaa1";
const ATTACKER_SURVEY_ID = "cm0bbbbbbbbbbbbbbbbbbbbb2";
const CANONICAL = "cm8f4x9mm0001gx9h5b7d7h3q";
const CIPHER = "encrypted-id";

const linkSurvey = (isEncrypted: boolean) =>
  ({ id: SURVEY_ID, type: "link", singleUse: { enabled: true, isEncrypted } }) as TSurvey;

const input = (suId: string | null, suToken?: string, bodySingleUseId = CANONICAL) => ({
  singleUseId: bodySingleUseId,
  meta: {
    url: `https://example.com/s/${SURVEY_ID}${suId ? `?suId=${suId}` : "?foo=bar"}${
      suToken ? `&suToken=${suToken}` : ""
    }`,
  },
});

const statusOf = (result: ReturnType<typeof validateSingleUseResponseInput>) =>
  (result as { response: Response }).response.status;

describe("validateSingleUseResponseInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.constants.ENCRYPTION_KEY = "test-key";
    vi.mocked(symmetricDecrypt).mockReturnValue(CANONICAL);
  });

  describe("not applicable", () => {
    test("returns null for an app survey", () => {
      const survey = { ...linkSurvey(true), type: "app" } as TSurvey;
      expect(validateSingleUseResponseInput(survey, "env-1", input(CIPHER))).toBeNull();
    });

    test("returns null when single use is disabled", () => {
      const survey = { ...linkSurvey(true), singleUse: { enabled: false, isEncrypted: true } } as TSurvey;
      expect(validateSingleUseResponseInput(survey, "env-1", input(CIPHER))).toBeNull();
    });
  });

  describe("misconfiguration and malformed input", () => {
    test("500s and logs when ENCRYPTION_KEY is not configured", () => {
      mocks.constants.ENCRYPTION_KEY = "";

      expect(statusOf(validateSingleUseResponseInput(linkSurvey(true), "env-1", input(CIPHER)))).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        { surveyId: SURVEY_ID, environmentId: "env-1" },
        "ENCRYPTION_KEY is not set"
      );
    });

    test("400s when the body carries no singleUseId", () => {
      const result = validateSingleUseResponseInput(linkSurvey(true), "env-1", {
        meta: { url: `https://example.com/?suId=${CIPHER}` },
      });

      expect(statusOf(result)).toBe(400);
      // cors: true — this endpoint is called cross-origin by the survey bundle.
      expect(responses.badRequestResponse).toHaveBeenCalledWith(
        "Missing single use id",
        { surveyId: SURVEY_ID, environmentId: "env-1" },
        true
      );
    });

    test.each([
      ["no meta.url", { singleUseId: CANONICAL, meta: {} }],
      ["an unparseable meta.url", { singleUseId: CANONICAL, meta: { url: "not-a-url" } }],
      ["a URL with no suId", input(null)],
    ])("400s on %s", (_label, responseInput) => {
      expect(
        statusOf(validateSingleUseResponseInput(linkSurvey(true), "env-1", responseInput as never))
      ).toBe(400);
    });
  });

  describe("encrypted mode (ENG-2758)", () => {
    test("400s on a suId with no binding token, and does not decrypt it", () => {
      expect(statusOf(validateSingleUseResponseInput(linkSurvey(true), "env-1", input(CIPHER)))).toBe(400);
      expect(symmetricDecrypt).not.toHaveBeenCalled();
    });

    test("400s on a suId whose token is bound to another survey", () => {
      // The replay: minted on the attacker's own survey, presented here. One shared ENCRYPTION_KEY
      // means the ciphertext decrypts fine; only the HMAC tells the two surveys apart.
      const forged = generateSurveySingleUseSignature(ATTACKER_SURVEY_ID, CIPHER);

      expect(statusOf(validateSingleUseResponseInput(linkSurvey(true), "env-1", input(CIPHER, forged)))).toBe(
        400
      );
    });

    test("accepts a suId bound to this survey and returns the canonical decrypted id", () => {
      const suToken = generateSurveySingleUseSignature(SURVEY_ID, CIPHER);

      expect(validateSingleUseResponseInput(linkSurvey(true), "env-1", input(CIPHER, suToken))).toEqual({
        singleUseId: CANONICAL,
      });
      expect(symmetricDecrypt).toHaveBeenCalledWith(CIPHER, "test-key");
    });

    test("400s when the decrypted id does not match the body's singleUseId", () => {
      const suToken = generateSurveySingleUseSignature(SURVEY_ID, CIPHER);
      const result = validateSingleUseResponseInput(
        linkSurvey(true),
        "env-1",
        input(CIPHER, suToken, "some-other-id")
      );

      expect(statusOf(result)).toBe(400);
    });
  });

  describe("plaintext mode", () => {
    test("400s on a suId with no token, and on a token bound to another survey", () => {
      expect(statusOf(validateSingleUseResponseInput(linkSurvey(false), "env-1", input(CANONICAL)))).toBe(
        400
      );

      const forged = generateSurveySingleUseSignature(ATTACKER_SURVEY_ID, CANONICAL);
      expect(
        statusOf(validateSingleUseResponseInput(linkSurvey(false), "env-1", input(CANONICAL, forged)))
      ).toBe(400);
    });

    test("accepts a correctly signed suId", () => {
      const suToken = generateSurveySingleUseSignature(SURVEY_ID, CANONICAL);

      expect(validateSingleUseResponseInput(linkSurvey(false), "env-1", input(CANONICAL, suToken))).toEqual({
        singleUseId: CANONICAL,
      });
    });
  });
});
