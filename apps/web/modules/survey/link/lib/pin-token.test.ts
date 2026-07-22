import jwt from "jsonwebtoken";
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn() },
}));

const TEST_SECRET = "test-secret-at-least-32-chars-long!!";

vi.mock("@/lib/constants", () => ({
  BETTER_AUTH_SECRET: undefined,
  NEXTAUTH_SECRET: TEST_SECRET,
}));

// Import after mocks are set up
const { createLinkSurveyPinToken, verifyLinkSurveyPinToken } = await import("./pin-token");

const SURVEY_ID = "clxsurvey0000abcdef123456";

describe("createLinkSurveyPinToken", () => {
  test("returns a signed JWT string", () => {
    const token = createLinkSurveyPinToken(SURVEY_ID);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });
});

describe("verifyLinkSurveyPinToken", () => {
  test("valid token for correct surveyId returns true", () => {
    const token = createLinkSurveyPinToken(SURVEY_ID);
    expect(verifyLinkSurveyPinToken(token, SURVEY_ID)).toBe(true);
  });

  test("valid token with wrong surveyId returns false", () => {
    const token = createLinkSurveyPinToken(SURVEY_ID);
    expect(verifyLinkSurveyPinToken(token, "clxsurveyXXXXabcdef000000")).toBe(false);
  });

  test("tampered token returns false", () => {
    const token = createLinkSurveyPinToken(SURVEY_ID);
    const parts = token.split(".");
    // Flip a character in the signature
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}X`;
    expect(verifyLinkSurveyPinToken(tampered, SURVEY_ID)).toBe(false);
  });

  test("null token returns false", () => {
    expect(verifyLinkSurveyPinToken(null, SURVEY_ID)).toBe(false);
  });

  test("undefined token returns false", () => {
    expect(verifyLinkSurveyPinToken(undefined, SURVEY_ID)).toBe(false);
  });

  test("token signed with a different purpose returns false", () => {
    const wrongPurposeToken = jwt.sign({ surveyId: SURVEY_ID, purpose: "some_other_purpose" }, TEST_SECRET, {
      algorithm: "HS256",
    });
    expect(verifyLinkSurveyPinToken(wrongPurposeToken, SURVEY_ID)).toBe(false);
  });

  test("expired token returns false", () => {
    const expiredToken = jwt.sign({ surveyId: SURVEY_ID, purpose: "link_survey_pin" }, TEST_SECRET, {
      algorithm: "HS256",
      expiresIn: -1,
    });
    expect(verifyLinkSurveyPinToken(expiredToken, SURVEY_ID)).toBe(false);
  });
});

describe("secret resolution", () => {
  test("prefers BETTER_AUTH_SECRET over NEXTAUTH_SECRET", async () => {
    vi.resetModules();
    const betterAuthSecret = "better-auth-secret-at-least-32-chars!!";
    vi.doMock("@/lib/constants", () => ({
      BETTER_AUTH_SECRET: betterAuthSecret,
      NEXTAUTH_SECRET: TEST_SECRET,
    }));
    const mod = await import("./pin-token");

    const token = mod.createLinkSurveyPinToken(SURVEY_ID);
    // Verifies against BETTER_AUTH_SECRET, not the NextAuth fallback.
    expect(() => jwt.verify(token, betterAuthSecret)).not.toThrow();
    expect(() => jwt.verify(token, TEST_SECRET)).toThrow();
    expect(mod.verifyLinkSurveyPinToken(token, SURVEY_ID)).toBe(true);
  });

  test("falls back to NEXTAUTH_SECRET when BETTER_AUTH_SECRET is unset", async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({
      BETTER_AUTH_SECRET: undefined,
      NEXTAUTH_SECRET: TEST_SECRET,
    }));
    const mod = await import("./pin-token");

    const token = mod.createLinkSurveyPinToken(SURVEY_ID);
    expect(() => jwt.verify(token, TEST_SECRET)).not.toThrow();
    expect(mod.verifyLinkSurveyPinToken(token, SURVEY_ID)).toBe(true);
  });
});
