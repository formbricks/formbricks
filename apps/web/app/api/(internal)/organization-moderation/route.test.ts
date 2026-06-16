import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { DELETE, GET, POST } from "./route";

const {
  mockIsAuthorized,
  mockGetContext,
  mockSuspend,
  mockUnsuspend,
  mockDelete,
  ConfirmationMismatchError,
} = vi.hoisted(() => {
  class ConfirmationMismatchError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ConfirmationMismatchError";
    }
  }
  return {
    mockIsAuthorized: vi.fn(),
    mockGetContext: vi.fn(),
    mockSuspend: vi.fn(),
    mockUnsuspend: vi.fn(),
    mockDelete: vi.fn(),
    ConfirmationMismatchError,
  };
});

vi.mock("@/modules/organization-moderation/lib/auth", () => ({
  isModerationRequestAuthorized: mockIsAuthorized,
}));

vi.mock("@/modules/organization-moderation/lib/service", () => ({
  getOrganizationContextBySurveyId: mockGetContext,
  suspendOrganizationBySurveyId: mockSuspend,
  unsuspendOrganizationBySurveyId: mockUnsuspend,
  deleteOrganizationBySurveyId: mockDelete,
  ConfirmationMismatchError,
}));

const SURVEY_ID = "survey_123";
const ORG_ID = "org_123";
const summary = { surveyId: SURVEY_ID, organizationId: ORG_ID, isSuspended: false };

const buildRequest = (url: string, init?: { method?: string; body?: string }) => new NextRequest(url, init);

describe("organization-moderation route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsAuthorized.mockReturnValue(true);
  });

  describe("GET", () => {
    test("returns 401 when unauthorized", async () => {
      mockIsAuthorized.mockReturnValue(false);
      const res = await GET(buildRequest("https://app.test/api/organization-moderation?surveyId=x"));
      expect(res.status).toBe(401);
    });

    test("returns 400 when surveyId is missing", async () => {
      const res = await GET(buildRequest("https://app.test/api/organization-moderation"));
      expect(res.status).toBe(400);
    });

    test("returns the resolved summary", async () => {
      mockGetContext.mockResolvedValue(summary);
      const res = await GET(
        buildRequest(`https://app.test/api/organization-moderation?surveyId=${SURVEY_ID}`)
      );
      expect(res.status).toBe(200);
      expect(mockGetContext).toHaveBeenCalledWith(SURVEY_ID);
    });

    test("returns 404 when the survey is not found", async () => {
      mockGetContext.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID));
      const res = await GET(
        buildRequest(`https://app.test/api/organization-moderation?surveyId=${SURVEY_ID}`)
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST", () => {
    test("suspends an organization", async () => {
      mockSuspend.mockResolvedValue({ ...summary, isSuspended: true });
      const res = await POST(
        buildRequest("https://app.test/api/organization-moderation", {
          method: "POST",
          body: JSON.stringify({ surveyId: SURVEY_ID, action: "suspend", reason: "abuse" }),
        })
      );
      expect(res.status).toBe(200);
      expect(mockSuspend).toHaveBeenCalledWith(SURVEY_ID, "abuse");
    });

    test("unsuspends an organization", async () => {
      mockUnsuspend.mockResolvedValue(summary);
      const res = await POST(
        buildRequest("https://app.test/api/organization-moderation", {
          method: "POST",
          body: JSON.stringify({ surveyId: SURVEY_ID, action: "unsuspend" }),
        })
      );
      expect(res.status).toBe(200);
      expect(mockUnsuspend).toHaveBeenCalledWith(SURVEY_ID);
    });

    test("returns 400 for an invalid action", async () => {
      const res = await POST(
        buildRequest("https://app.test/api/organization-moderation", {
          method: "POST",
          body: JSON.stringify({ surveyId: SURVEY_ID, action: "nuke" }),
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    test("deletes when confirmation matches", async () => {
      mockDelete.mockResolvedValue(summary);
      const res = await DELETE(
        buildRequest("https://app.test/api/organization-moderation", {
          method: "DELETE",
          body: JSON.stringify({ surveyId: SURVEY_ID, confirmOrganizationId: ORG_ID }),
        })
      );
      expect(res.status).toBe(200);
      expect(mockDelete).toHaveBeenCalledWith(SURVEY_ID, ORG_ID);
    });

    test("returns 400 on confirmation mismatch", async () => {
      mockDelete.mockRejectedValue(new ConfirmationMismatchError("mismatch"));
      const res = await DELETE(
        buildRequest("https://app.test/api/organization-moderation", {
          method: "DELETE",
          body: JSON.stringify({ surveyId: SURVEY_ID, confirmOrganizationId: "wrong" }),
        })
      );
      expect(res.status).toBe(400);
    });

    test("returns 400 when confirmOrganizationId is missing", async () => {
      const res = await DELETE(
        buildRequest("https://app.test/api/organization-moderation", {
          method: "DELETE",
          body: JSON.stringify({ surveyId: SURVEY_ID }),
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
