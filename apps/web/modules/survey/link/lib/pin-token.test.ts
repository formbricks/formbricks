import jwt from "jsonwebtoken";
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn() },
}));

const TEST_SECRET = "test-secret-at-least-32-chars-long!!";

// `AUTH_SECRET` is the already-resolved BETTER_AUTH_SECRET/NEXTAUTH_SECRET value; which of the two
// wins is constants.ts's business and is covered by lib/constants.test.ts.
vi.mock("@/lib/constants", () => ({
  AUTH_SECRET: TEST_SECRET,
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
  test("signs with the resolved auth secret", async () => {
    vi.resetModules();
    const otherSecret = "some-other-secret-at-least-32-chars!!";
    vi.doMock("@/lib/constants", () => ({ AUTH_SECRET: otherSecret }));
    const mod = await import("./pin-token");

    const token = mod.createLinkSurveyPinToken(SURVEY_ID);
    expect(() => jwt.verify(token, otherSecret)).not.toThrow();
    // A token signed with anything else must not verify — this is what keeps PIN enforcement tied to
    // the same secret auth.ts uses rather than drifting to a stale one.
    expect(() => jwt.verify(token, TEST_SECRET)).toThrow();
    expect(mod.verifyLinkSurveyPinToken(token, SURVEY_ID)).toBe(true);
  });

  test("throws when no auth secret is set", async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({ AUTH_SECRET: undefined }));
    const mod = await import("./pin-token");

    expect(() => mod.createLinkSurveyPinToken(SURVEY_ID)).toThrow(
      "No auth secret set (BETTER_AUTH_SECRET or NEXTAUTH_SECRET)"
    );
  });
});
