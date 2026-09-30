import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";
import { buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";
import { validateInputs } from "@/lib/utils/validate";
import { getSurveys } from "./surveys";

// Mock dependencies
vi.mock("@/lib/survey/service", () => ({
  selectSurvey: { id: true, name: true, status: true, updatedAt: true }, // Expanded mock based on usage
}));
vi.mock("@/lib/survey/utils");
vi.mock("@/lib/survey/visibility/actor-context", () => ({ getUserVisibleSurveyWhere: vi.fn() }));
vi.mock("@/lib/utils/validate");
vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Mock reactCache to just return the function
  };
});

const workspaceId = "test-environment-id";
const userId = "member-user-id";
const organizationId = "organization-id";
// Use 'as any' to bypass complex type matching for mock data
const mockPrismaSurveys = [
  { id: "survey1", name: "Survey 1", status: "inProgress", updatedAt: new Date() },
  { id: "survey2", name: "Survey 2", status: "draft", updatedAt: new Date() },
] as any; // Use 'as any' to bypass complex type matching
const mockTransformedSurveys: TSurvey[] = [
  {
    id: "survey1",
    name: "Survey 1",
    status: "inProgress",
    questions: [],
    triggers: [],
    recontactDays: null,
    displayOption: "displayOnce",
    autoClose: null,
    delay: 0,
    autoComplete: null,
    surveyClosedMessage: null,
    singleUse: null,
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: false },
    type: "app", // Changed type to web to match original file
    workspaceId: workspaceId,
    createdAt: new Date(),
    updatedAt: new Date(),
    languages: [],
    styling: null,
  } as unknown as TSurvey,
  {
    id: "survey2",
    name: "Survey 2",
    status: "draft",
    questions: [],
    triggers: [],
    recontactDays: null,
    displayOption: "displayOnce",
    autoClose: null,
    delay: 0,
    autoComplete: null,
    surveyClosedMessage: null,
    singleUse: null,
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: false },
    type: "app",
    workspaceId: workspaceId,
    createdAt: new Date(),
    updatedAt: new Date(),
    languages: [],
    styling: null,
  } as unknown as TSurvey,
];

describe("getSurveys", () => {
  beforeEach(() => {
    // Enforcement off by default: no visibility clause, the query exactly as before ENG-3282.
    vi.mocked(getUserVisibleSurveyWhere).mockResolvedValue({});
  });

  test("should fetch and transform surveys successfully", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockPrismaSurveys as any);
    vi.mocked(transformPrismaSurvey).mockImplementation((survey) => {
      const found = mockTransformedSurveys.find((ts) => ts.id === survey.id);
      if (!found) throw new Error("Survey not found in mock transformed data");
      // Ensure the returned object matches the TSurvey structure precisely
      return { ...found } as TSurvey;
    });

    const surveys = await getSurveys(workspaceId, userId, organizationId);

    expect(surveys).toEqual(mockTransformedSurveys);
    // Use expect.any(ZId) for the Zod schema validation check
    expect(validateInputs).toHaveBeenCalledWith(
      [workspaceId, expect.any(Object)],
      [userId, expect.any(Object)],
      [organizationId, expect.any(Object)]
    );
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId,
        status: {
          not: "completed",
        },
        archivedAt: null,
      },
      select: selectSurvey,
      orderBy: {
        updatedAt: "desc",
      },
    });
    expect(transformPrismaSurvey).toHaveBeenCalledTimes(mockPrismaSurveys.length);
    expect(transformPrismaSurvey).toHaveBeenCalledWith(mockPrismaSurveys[0]);
    expect(transformPrismaSurvey).toHaveBeenCalledWith(mockPrismaSurveys[1]);
    // React cache is already mocked globally - no need to check it here
  });

  // ENG-3395: the Slack, Notion, Airtable and Google Sheets pickers load through here. A plain member
  // must never be offered another user's restricted survey, so the member's clause has to reach SQL.
  test("offers a member only workspace-visible surveys and their own restricted ones", async () => {
    const memberClause = buildVisibleSurveyWhere({
      enforced: true,
      kind: "user",
      userId,
      isOrganizationAdmin: false,
    });
    vi.mocked(getUserVisibleSurveyWhere).mockResolvedValue(memberClause);
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);

    await getSurveys(workspaceId, userId, organizationId);

    expect(getUserVisibleSurveyWhere).toHaveBeenCalledWith(userId, organizationId);
    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId,
          status: { not: "completed" },
          archivedAt: null,
          AND: [
            {
              OR: [
                {
                  visibility: "workspace",
                  OR: [
                    { visibilityPending: false },
                    { visibilityProjectedVersion: { lt: 0 }, visibilityVersion: 0 },
                  ],
                },
                { ownerId: userId },
              ],
            },
          ],
        },
      })
    );
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database connection error", {
      code: "P2002",
      clientVersion: "4.0.0",
    });

    vi.mocked(prisma.survey.findMany).mockRejectedValueOnce(prismaError);

    await expect(getSurveys(workspaceId, userId, organizationId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith({ error: prismaError }, "getSurveys: Could not fetch surveys");
    // React cache is already mocked globally - no need to check it here
  });

  test("should throw original error on other errors", async () => {
    const genericError = new Error("Some other error");

    vi.mocked(prisma.survey.findMany).mockRejectedValueOnce(genericError);

    await expect(getSurveys(workspaceId, userId, organizationId)).rejects.toThrow(genericError);
    expect(logger.error).not.toHaveBeenCalled();
    // React cache is already mocked globally - no need to check it here
  });
});
