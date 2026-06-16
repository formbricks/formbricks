import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  ConfirmationMismatchError,
  deleteOrganizationBySurveyId,
  getOrganizationContextBySurveyId,
  suspendOrganizationBySurveyId,
  unsuspendOrganizationBySurveyId,
} from "./service";

const { mockSurveyFindUnique, mockSuspendOrganization, mockUnsuspendOrganization, mockDeleteOrganization } =
  vi.hoisted(() => ({
    mockSurveyFindUnique: vi.fn(),
    mockSuspendOrganization: vi.fn(),
    mockUnsuspendOrganization: vi.fn(),
    mockDeleteOrganization: vi.fn(),
  }));

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: mockSurveyFindUnique,
    },
  },
}));

vi.mock("@/lib/organization/service", () => ({
  suspendOrganization: mockSuspendOrganization,
  unsuspendOrganization: mockUnsuspendOrganization,
  deleteOrganization: mockDeleteOrganization,
}));

const SURVEY_ID = "survey_123";
const ORG_ID = "org_123";

const surveyRecord = (overrides?: { suspendedAt?: Date | null }) => ({
  id: SURVEY_ID,
  name: "Fraudulent Survey",
  status: "inProgress",
  workspace: {
    id: "ws_123",
    name: "Bad Workspace",
    organization: {
      id: ORG_ID,
      name: "Bad Org",
      suspendedAt: overrides?.suspendedAt ?? null,
      suspendedReason: null,
      memberships: [{ role: "owner", user: { email: "owner@example.com", name: "Owner" } }],
    },
  },
});

describe("getOrganizationContextBySurveyId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns a summary for a known survey", async () => {
    mockSurveyFindUnique.mockResolvedValue(surveyRecord());

    const summary = await getOrganizationContextBySurveyId(SURVEY_ID);

    expect(summary.organizationId).toBe(ORG_ID);
    expect(summary.surveyId).toBe(SURVEY_ID);
    expect(summary.isSuspended).toBe(false);
    expect(summary.members).toEqual([{ email: "owner@example.com", role: "owner", name: "Owner" }]);
  });

  test("throws ResourceNotFoundError when the survey does not exist", async () => {
    mockSurveyFindUnique.mockResolvedValue(null);
    await expect(getOrganizationContextBySurveyId(SURVEY_ID)).rejects.toThrow(ResourceNotFoundError);
  });
});

describe("suspendOrganizationBySurveyId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("suspends the resolved organization", async () => {
    mockSurveyFindUnique.mockResolvedValue(surveyRecord());

    const summary = await suspendOrganizationBySurveyId(SURVEY_ID, "abuse");

    expect(mockSuspendOrganization).toHaveBeenCalledWith(ORG_ID, "abuse");
    expect(summary.isSuspended).toBe(true);
  });
});

describe("unsuspendOrganizationBySurveyId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("unsuspends the resolved organization", async () => {
    mockSurveyFindUnique.mockResolvedValue(surveyRecord({ suspendedAt: new Date() }));

    const summary = await unsuspendOrganizationBySurveyId(SURVEY_ID);

    expect(mockUnsuspendOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(summary.isSuspended).toBe(false);
  });
});

describe("deleteOrganizationBySurveyId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("deletes when the confirmation id matches", async () => {
    mockSurveyFindUnique.mockResolvedValue(surveyRecord());

    await deleteOrganizationBySurveyId(SURVEY_ID, ORG_ID);

    expect(mockDeleteOrganization).toHaveBeenCalledWith(ORG_ID);
  });

  test("throws and does not delete when the confirmation id mismatches", async () => {
    mockSurveyFindUnique.mockResolvedValue(surveyRecord());

    await expect(deleteOrganizationBySurveyId(SURVEY_ID, "wrong_org")).rejects.toThrow(
      ConfirmationMismatchError
    );
    expect(mockDeleteOrganization).not.toHaveBeenCalled();
  });
});
