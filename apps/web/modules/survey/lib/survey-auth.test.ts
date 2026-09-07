import { notFound } from "next/navigation";
import { Mocked, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { Session } from "@formbricks/types/auth";
import { DatabaseError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { getSession } from "@/modules/auth/lib/session";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TWorkspaceAuth } from "@/modules/workspaces/types/workspace-auth";
import { canReadSurveyInWorkspace, getSurveyAuth } from "./survey-auth";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/modules/workspaces/lib/utils", () => ({
  getWorkspaceAuth: vi.fn(),
}));

// reactCache(fn) returns fn, which is then invoked
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

const mockPrismaSurvey = prisma.survey as Mocked<typeof prisma.survey>;
const mockGetWorkspaceAuth = vi.mocked(getWorkspaceAuth);
const mockGetSession = vi.mocked(getSession);
const mockCan = vi.mocked(can);

const ATTACKER_USER_ID = "user_attacker";
const ATTACKER_WORKSPACE_ID = "workspace_attacker";
const VICTIM_WORKSPACE_ID = "workspace_victim";
const SURVEY_ID = "survey_victim";

// The lookup under test selects `workspaceId` alone, so fixtures are typed against that projection
// rather than a whole Survey row — a schema rename breaks this file instead of leaving it green on a
// stale fixture. The cast is the seam between Prisma's generic delegate typing and the concrete
// projection; the survey fixtures themselves stay checked against it. (`buildWorkspaceAuth` below
// casts too, for its own reason.)
type TSurveyWorkspaceIdSelection = Prisma.SurveyGetPayload<{ select: { workspaceId: true } }>;

const mockSurveyLookup = (survey: TSurveyWorkspaceIdSelection | null): void => {
  mockPrismaSurvey.findUnique.mockResolvedValueOnce(
    survey as unknown as Awaited<ReturnType<typeof prisma.survey.findUnique>>
  );
};

const buildSession = (userId: string): Session => ({
  user: { id: userId },
  expires: "2100-01-01T00:00:00.000Z",
});

// Only `workspace.id` is read by the code under test; the rest of TWorkspaceAuth is getWorkspaceAuth's
// contract, covered where that helper is tested.
const buildWorkspaceAuth = (workspaceId: string) =>
  ({ workspace: { id: workspaceId }, isOwner: true }) as unknown as TWorkspaceAuth;

describe("canReadSurveyInWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(buildSession(ATTACKER_USER_ID));
    mockCan.mockResolvedValue(true);
  });

  test("is true for a survey in a workspace the caller can read", async () => {
    mockSurveyLookup({ workspaceId: VICTIM_WORKSPACE_ID });

    await expect(canReadSurveyInWorkspace(VICTIM_WORKSPACE_ID, SURVEY_ID)).resolves.toBe(true);
    expect(mockPrismaSurvey.findUnique).toHaveBeenCalledWith({
      where: { id: SURVEY_ID },
      select: { workspaceId: true },
    });
    expect(mockCan).toHaveBeenCalledWith({ type: "user", id: ATTACKER_USER_ID }, "workspace.read", {
      type: "workspace",
      id: VICTIM_WORKSPACE_ID,
    });
  });

  test("is false when the survey does not exist", async () => {
    mockSurveyLookup(null);

    await expect(canReadSurveyInWorkspace(VICTIM_WORKSPACE_ID, "survey_missing")).resolves.toBe(false);
  });

  test("is false for a foreign survey, without even checking workspace access", async () => {
    mockSurveyLookup({ workspaceId: VICTIM_WORKSPACE_ID });

    await expect(canReadSurveyInWorkspace(ATTACKER_WORKSPACE_ID, SURVEY_ID)).resolves.toBe(false);
    expect(mockCan).not.toHaveBeenCalled();
  });

  test("is false when the caller has no access to the workspace", async () => {
    mockSurveyLookup({ workspaceId: VICTIM_WORKSPACE_ID });
    mockCan.mockResolvedValueOnce(false);

    await expect(canReadSurveyInWorkspace(VICTIM_WORKSPACE_ID, SURVEY_ID)).resolves.toBe(false);
  });

  test("is false without a session", async () => {
    mockSurveyLookup({ workspaceId: VICTIM_WORKSPACE_ID });
    mockGetSession.mockResolvedValueOnce(null);

    await expect(canReadSurveyInWorkspace(VICTIM_WORKSPACE_ID, SURVEY_ID)).resolves.toBe(false);
  });
});

describe("getSurveyAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the workspace authorization when the survey belongs to the workspace", async () => {
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(VICTIM_WORKSPACE_ID));
    mockSurveyLookup({ workspaceId: VICTIM_WORKSPACE_ID });

    const auth = await getSurveyAuth(VICTIM_WORKSPACE_ID, SURVEY_ID);

    expect(auth.workspace.id).toBe(VICTIM_WORKSPACE_ID);
    expect(notFound).not.toHaveBeenCalled();
  });

  test("404s when the caller pairs their own workspace with a foreign survey", async () => {
    // The cross-tenant read: authorization for the attacker's own workspace succeeds, but the
    // survey in the URL belongs to someone else.
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(ATTACKER_WORKSPACE_ID));
    mockSurveyLookup({ workspaceId: VICTIM_WORKSPACE_ID });

    await expect(getSurveyAuth(ATTACKER_WORKSPACE_ID, SURVEY_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  test("404s when the survey does not exist", async () => {
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(ATTACKER_WORKSPACE_ID));
    mockSurveyLookup(null);

    await expect(getSurveyAuth(ATTACKER_WORKSPACE_ID, "survey_missing")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("propagates the workspace authorization failure instead of masking it as a 404", async () => {
    mockGetWorkspaceAuth.mockRejectedValueOnce(new Error("not authorized"));
    mockSurveyLookup({ workspaceId: VICTIM_WORKSPACE_ID });

    await expect(getSurveyAuth(VICTIM_WORKSPACE_ID, SURVEY_ID)).rejects.toThrow("not authorized");
  });

  test("wraps a Prisma failure of the survey lookup in a DatabaseError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(VICTIM_WORKSPACE_ID));
    mockPrismaSurvey.findUnique.mockRejectedValueOnce(prismaError);

    await expect(getSurveyAuth(VICTIM_WORKSPACE_ID, SURVEY_ID)).rejects.toThrow(DatabaseError);
  });

  test("re-throws a non-Prisma failure of the survey lookup unchanged", async () => {
    const error = new Error("Unknown error");
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(VICTIM_WORKSPACE_ID));
    mockPrismaSurvey.findUnique.mockRejectedValueOnce(error);

    await expect(getSurveyAuth(VICTIM_WORKSPACE_ID, SURVEY_ID)).rejects.toThrow(error);
  });
});
