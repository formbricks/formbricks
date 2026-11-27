import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { symmetricEncrypt } from "@/lib/crypto";
import { CONTACT_SURVEY_LINK_PURPOSE, verifyContactSurveyToken } from "./contact-survey-link";

// Real jsonwebtoken and real crypto: these tests prove which tokens verify, so nothing about the
// signature or the cipher is mocked.
const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

vi.mock("@/lib/constants", () => ({
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
}));
vi.mock("@/lib/getPublicUrl", () => ({ getPublicDomain: () => "https://example.test" }));
vi.mock("@/lib/utils/single-use-surveys", () => ({ generateSurveySingleUseLinkParams: vi.fn() }));
vi.mock("@/modules/survey/lib/survey", () => ({ getSurvey: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

const claims = () => ({
  contactId: symmetricEncrypt("contact-1", KEY),
  surveyId: symmetricEncrypt("survey-1", KEY),
});

describe("verifyContactSurveyToken", () => {
  beforeEach(() => vi.clearAllMocks());

  test("verifies a token signed before the purpose claim existed (already-sent links)", () => {
    const legacy = jwt.sign(claims(), KEY, { algorithm: "HS256" });
    expect(verifyContactSurveyToken(legacy)).toEqual({
      ok: true,
      data: { contactId: "contact-1", surveyId: "survey-1" },
    });
  });

  test("verifies a token that carries the contact-link purpose", () => {
    const token = jwt.sign({ ...claims(), purpose: CONTACT_SURVEY_LINK_PURPOSE }, KEY, {
      algorithm: "HS256",
    });
    expect(verifyContactSurveyToken(token).ok).toBe(true);
  });

  test("refuses a token minted for another flow with the same key", () => {
    const token = jwt.sign({ ...claims(), purpose: "invite" }, KEY, { algorithm: "HS256" });
    const result = verifyContactSurveyToken(token);
    expect(result.ok).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("refuses a token signed with a non-HS256 algorithm", () => {
    const token = jwt.sign(claims(), KEY, { algorithm: "HS512" });
    expect(verifyContactSurveyToken(token).ok).toBe(false);
  });

  test("refuses an unsigned (alg none) token", () => {
    const token = jwt.sign(claims(), "", { algorithm: "none" });
    expect(verifyContactSurveyToken(token).ok).toBe(false);
  });

  test.each(["junk", "a.b.c", ""])("anonymous junk %j is a warning, not an error", (junk) => {
    expect(verifyContactSurveyToken(junk).ok).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("an expired token reports expiry and is a warning", () => {
    const token = jwt.sign(claims(), KEY, { algorithm: "HS256", expiresIn: "-1s" });
    const result = verifyContactSurveyToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ details: [{ issue: "token_expired" }] });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("a validly signed token whose ciphertext cannot be decrypted stays an error", () => {
    const token = jwt.sign({ contactId: "not-ciphertext", surveyId: "x:y:z" }, KEY, { algorithm: "HS256" });
    expect(verifyContactSurveyToken(token).ok).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
