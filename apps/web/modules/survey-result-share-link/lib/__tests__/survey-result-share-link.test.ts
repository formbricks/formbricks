import {
  MOCK_LINK_ID,
  MOCK_SHARE_LINK,
  MOCK_SUMMARY_WITH_PII,
  MOCK_SURVEY_ID,
  MOCK_TOKEN,
  MOCK_USER_ID,
} from "./__mocks__/survey-result-share-link-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { verifyResultShareToken } from "@/lib/jwt";
import {
  createSurveyResultShareLink,
  getSurveyResultShareLinks,
  revokeSurveyResultShareLink,
  stripPiiFromSummary,
  validateShareLink,
} from "../survey-result-share-link";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    surveyResultShareLink: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/jwt", () => ({
  createResultShareToken: vi.fn().mockReturnValue(MOCK_TOKEN),
  verifyResultShareToken: vi.fn(),
}));

describe("survey-result-share-link service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSurveyResultShareLink", () => {
    test("creates a share link when under the limit", async () => {
      vi.mocked(prisma.surveyResultShareLink.count).mockResolvedValue(0);
      vi.mocked(prisma.surveyResultShareLink.create).mockResolvedValue({
        ...MOCK_SHARE_LINK,
        token: "",
      } as any);
      vi.mocked(prisma.surveyResultShareLink.update).mockResolvedValue(MOCK_SHARE_LINK as any);

      const result = await createSurveyResultShareLink(MOCK_SURVEY_ID, MOCK_USER_ID, "never", "Test Link");

      expect(result).toEqual(MOCK_SHARE_LINK);
      expect(prisma.surveyResultShareLink.count).toHaveBeenCalledTimes(1);
      expect(prisma.surveyResultShareLink.create).toHaveBeenCalledTimes(1);
      expect(prisma.surveyResultShareLink.update).toHaveBeenCalledTimes(1);
    });

    test("throws OperationNotAllowedError when max links reached", async () => {
      vi.mocked(prisma.surveyResultShareLink.count).mockResolvedValue(5);

      await expect(createSurveyResultShareLink(MOCK_SURVEY_ID, MOCK_USER_ID, "never")).rejects.toThrowError(
        OperationNotAllowedError
      );
    });

    test("sets expiration for 7d", async () => {
      vi.mocked(prisma.surveyResultShareLink.count).mockResolvedValue(0);
      vi.mocked(prisma.surveyResultShareLink.create).mockResolvedValue({
        ...MOCK_SHARE_LINK,
        token: "",
      } as any);
      vi.mocked(prisma.surveyResultShareLink.update).mockResolvedValue(MOCK_SHARE_LINK as any);

      await createSurveyResultShareLink(MOCK_SURVEY_ID, MOCK_USER_ID, "7d");

      const createCall = vi.mocked(prisma.surveyResultShareLink.create).mock.calls[0][0];
      expect(createCall.data.expiresAt).toBeInstanceOf(Date);
    });

    test("sets null expiration for 'never'", async () => {
      vi.mocked(prisma.surveyResultShareLink.count).mockResolvedValue(0);
      vi.mocked(prisma.surveyResultShareLink.create).mockResolvedValue({
        ...MOCK_SHARE_LINK,
        token: "",
      } as any);
      vi.mocked(prisma.surveyResultShareLink.update).mockResolvedValue(MOCK_SHARE_LINK as any);

      await createSurveyResultShareLink(MOCK_SURVEY_ID, MOCK_USER_ID, "never");

      const createCall = vi.mocked(prisma.surveyResultShareLink.create).mock.calls[0][0];
      expect(createCall.data.expiresAt).toBeNull();
    });
  });

  describe("getSurveyResultShareLinks", () => {
    test("returns share links for a survey", async () => {
      vi.mocked(prisma.surveyResultShareLink.findMany).mockResolvedValue([MOCK_SHARE_LINK] as any);

      const result = await getSurveyResultShareLinks(MOCK_SURVEY_ID);

      expect(result).toEqual([MOCK_SHARE_LINK]);
      expect(prisma.surveyResultShareLink.findMany).toHaveBeenCalledWith({
        where: { surveyId: MOCK_SURVEY_ID },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("revokeSurveyResultShareLink", () => {
    test("revokes an active link", async () => {
      vi.mocked(prisma.surveyResultShareLink.findUnique).mockResolvedValue(MOCK_SHARE_LINK as any);
      vi.mocked(prisma.surveyResultShareLink.update).mockResolvedValue({
        ...MOCK_SHARE_LINK,
        revokedAt: new Date(),
      } as any);

      const result = await revokeSurveyResultShareLink(MOCK_LINK_ID);

      expect(result.revokedAt).toBeInstanceOf(Date);
    });

    test("throws ResourceNotFoundError for non-existent link", async () => {
      vi.mocked(prisma.surveyResultShareLink.findUnique).mockResolvedValue(null);

      await expect(revokeSurveyResultShareLink("non-existent")).rejects.toThrowError(ResourceNotFoundError);
    });

    test("throws OperationNotAllowedError for already revoked link", async () => {
      vi.mocked(prisma.surveyResultShareLink.findUnique).mockResolvedValue({
        ...MOCK_SHARE_LINK,
        revokedAt: new Date(),
      } as any);

      await expect(revokeSurveyResultShareLink(MOCK_LINK_ID)).rejects.toThrowError(OperationNotAllowedError);
    });
  });

  describe("validateShareLink", () => {
    test("returns linkId and surveyId for valid token", async () => {
      vi.mocked(verifyResultShareToken).mockReturnValueOnce({
        linkId: MOCK_LINK_ID,
        surveyId: MOCK_SURVEY_ID,
      });
      vi.mocked(prisma.surveyResultShareLink.findUnique).mockResolvedValue(MOCK_SHARE_LINK as any);

      const result = await validateShareLink(MOCK_TOKEN);

      expect(result).toEqual({ linkId: MOCK_LINK_ID, surveyId: MOCK_SURVEY_ID });
    });

    test("returns null for revoked link", async () => {
      vi.mocked(verifyResultShareToken).mockReturnValueOnce({
        linkId: MOCK_LINK_ID,
        surveyId: MOCK_SURVEY_ID,
      });
      vi.mocked(prisma.surveyResultShareLink.findUnique).mockResolvedValue({
        ...MOCK_SHARE_LINK,
        revokedAt: new Date(),
      } as any);

      const result = await validateShareLink(MOCK_TOKEN);

      expect(result).toBeNull();
    });

    test("returns null for expired link", async () => {
      vi.mocked(verifyResultShareToken).mockReturnValueOnce({
        linkId: MOCK_LINK_ID,
        surveyId: MOCK_SURVEY_ID,
      });
      vi.mocked(prisma.surveyResultShareLink.findUnique).mockResolvedValue({
        ...MOCK_SHARE_LINK,
        expiresAt: new Date("2020-01-01"),
      } as any);

      const result = await validateShareLink(MOCK_TOKEN);

      expect(result).toBeNull();
    });

    test("returns null when JWT verification fails", async () => {
      vi.mocked(verifyResultShareToken).mockReturnValueOnce(null);

      const result = await validateShareLink("invalid-token");

      expect(result).toBeNull();
    });
  });

  describe("stripPiiFromSummary", () => {
    test("strips contact data from samples", () => {
      const result = stripPiiFromSummary(MOCK_SUMMARY_WITH_PII);

      // Check that samples have nullified contact
      const openTextSummary = result.summary[0] as any;
      expect(openTextSummary.samples[0].contact).toBeNull();
      expect(openTextSummary.samples[0].contactAttributes).toEqual({});
      expect(openTextSummary.samples[0].value).toBe("Great product!");
    });

    test("strips contact data from multiple choice others", () => {
      const result = stripPiiFromSummary(MOCK_SUMMARY_WITH_PII);

      const mcSummary = result.summary[1] as any;
      const otherChoice = mcSummary.choices.find((c: any) => c.value === "Other");
      expect(otherChoice.others[0].contact).toBeNull();
      expect(otherChoice.others[0].contactAttributes).toEqual({});
      expect(otherChoice.others[0].value).toBe("Custom answer");
    });

    test("empties quotas array", () => {
      const result = stripPiiFromSummary(MOCK_SUMMARY_WITH_PII);

      expect(result.quotas).toEqual([]);
    });

    test("preserves meta and dropOff data", () => {
      const result = stripPiiFromSummary(MOCK_SUMMARY_WITH_PII);

      expect(result.meta).toEqual(MOCK_SUMMARY_WITH_PII.meta);
      expect(result.dropOff).toEqual(MOCK_SUMMARY_WITH_PII.dropOff);
    });

    test("preserves response values", () => {
      const result = stripPiiFromSummary(MOCK_SUMMARY_WITH_PII);

      const openTextSummary = result.summary[0] as any;
      expect(openTextSummary.samples[0].value).toBe("Great product!");
      expect(openTextSummary.samples[1].value).toBe("Needs improvement");
    });
  });
});
