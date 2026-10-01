import { auditSettings } from "@/modules/auth/lib/__mocks__/security-action-boundaries";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { validateSurveyPinAction } from "./actions";
import { getSurveyWithMetadata } from "./lib/data";
import { createLinkSurveyPinToken } from "./lib/pin-token";

vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromSurveyId: vi.fn() }));
vi.mock("@/modules/ee/whitelabel/email-customization/lib/organization", () => ({
  getOrganizationLogoUrl: vi.fn(),
}));
vi.mock("@/modules/email", () => ({ sendLinkSurveyToVerifiedEmail: vi.fn() }));
vi.mock("./lib/data", () => ({ getSurveyWithMetadata: vi.fn() }));
vi.mock("./lib/pin-token", () => ({ createLinkSurveyPinToken: vi.fn() }));
const surveyId = "abcdefghijklmnopqrstuvwxyz";
const survey = { id: surveyId, pin: "1234", questions: [{ text: "private content" }] };
beforeEach(() => {
  auditSettings.enabled = true;
  vi.mocked(getSurveyWithMetadata).mockResolvedValue(survey as never);
  vi.mocked(getOrganizationIdFromSurveyId).mockResolvedValue("org-1");
  vi.mocked(createLinkSurveyPinToken).mockReturnValue("private-pin-token");
});

describe("public survey PIN verification", () => {
  test("success records authoritative tenant and issuance without PIN, survey content or token", async () => {
    expect(await validateSurveyPinAction({ surveyId, pin: "1234" })).toMatchObject({
      data: { pinAuthToken: "private-pin-token" },
    });
    expect(logger.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { type: "survey", id: surveyId },
        organizationId: "org-1",
        scope: "organization",
        status: "success",
        changes: {
          operation: "survey_pin_verification",
          tokenIssued: true,
          tokenFingerprint: expect.stringMatching(/^sha256:/),
        },
      })
    );
    expect(JSON.stringify(vi.mocked(logger.audit).mock.calls)).not.toMatch(
      /1234|private content|private-pin-token/
    );
  });
  test("wrong PIN, no PIN and signer failure have distinct outcomes", async () => {
    await validateSurveyPinAction({ surveyId, pin: "wrong" });
    expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "denied" }));
    vi.mocked(getSurveyWithMetadata).mockResolvedValueOnce({ ...survey, pin: null } as never);
    await validateSurveyPinAction({ surveyId, pin: "anything" });
    expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "noop" }));
    vi.mocked(createLinkSurveyPinToken).mockImplementation(() => {
      throw new Error("signing failed");
    });
    await validateSurveyPinAction({ surveyId, pin: "1234" });
    expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failure" }));
  });
  test("audit disabled or tenant lookup/sink failure does not change verification", async () => {
    auditSettings.enabled = false;
    expect(await validateSurveyPinAction({ surveyId, pin: "1234" })).toMatchObject({
      data: { pinAuthToken: "private-pin-token" },
    });
    expect(logger.audit).not.toHaveBeenCalled();
    expect(getOrganizationIdFromSurveyId).not.toHaveBeenCalled();
    auditSettings.enabled = true;
    vi.mocked(getOrganizationIdFromSurveyId).mockRejectedValue(new Error("audit lookup unavailable"));
    vi.mocked(logger.audit).mockImplementation(() => {
      throw new Error("sink unavailable");
    });
    expect(await validateSurveyPinAction({ surveyId, pin: "1234" })).toMatchObject({
      data: { pinAuthToken: "private-pin-token" },
    });
  });
});
