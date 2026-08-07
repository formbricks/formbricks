import { notFound } from "next/navigation";
import { Mocked, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { hasUserWorkspaceAccessForAction } from "@/lib/workspace/auth";
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

vi.mock("@/lib/workspace/auth", () => ({
  hasUserWorkspaceAccessForAction: vi.fn(),
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
const mockHasWorkspaceAccess = vi.mocked(hasUserWorkspaceAccessForAction);

const ATTACKER_WORKSPACE_ID = "workspace_attacker";
const VICTIM_WORKSPACE_ID = "workspace_victim";
const SURVEY_ID = "survey_victim";

const buildWorkspaceAuth = (workspaceId: string) =>
  ({ workspace: { id: workspaceId }, isOwner: true }) as unknown as TWorkspaceAuth;

describe("canReadSurveyInWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user_attacker" } } as any);
    mockHasWorkspaceAccess.mockResolvedValue(true);
  });

  test("is true for a survey in a workspace the caller can read", async () => {
    mockPrismaSurvey.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);

    await expect(canReadSurveyInWorkspace(SURVEY_ID, VICTIM_WORKSPACE_ID)).resolves.toBe(true);
    expect(mockPrismaSurvey.findUnique).toHaveBeenCalledWith({
      where: { id: SURVEY_ID },
      select: { workspaceId: true },
    });
    expect(mockHasWorkspaceAccess).toHaveBeenCalledWith("user_attacker", VICTIM_WORKSPACE_ID, "GET");
  });

  test("is false when the survey does not exist", async () => {
    mockPrismaSurvey.findUnique.mockResolvedValueOnce(null);

    await expect(canReadSurveyInWorkspace("survey_missing", VICTIM_WORKSPACE_ID)).resolves.toBe(false);
  });

  test("is false for a foreign survey, without even checking workspace access", async () => {
    mockPrismaSurvey.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);

    await expect(canReadSurveyInWorkspace(SURVEY_ID, ATTACKER_WORKSPACE_ID)).resolves.toBe(false);
    expect(mockHasWorkspaceAccess).not.toHaveBeenCalled();
  });

  test("is false when the caller has no access to the workspace", async () => {
    mockPrismaSurvey.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);
    mockHasWorkspaceAccess.mockResolvedValueOnce(false);

    await expect(canReadSurveyInWorkspace(SURVEY_ID, VICTIM_WORKSPACE_ID)).resolves.toBe(false);
  });

  test("is false without a session", async () => {
    mockPrismaSurvey.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);
    mockGetSession.mockResolvedValueOnce(null);

    await expect(canReadSurveyInWorkspace(SURVEY_ID, VICTIM_WORKSPACE_ID)).resolves.toBe(false);
  });
});

describe("getSurveyAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the workspace authorization when the survey belongs to the workspace", async () => {
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(VICTIM_WORKSPACE_ID));
    mockPrismaSurvey.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);

    const auth = await getSurveyAuth(VICTIM_WORKSPACE_ID, SURVEY_ID);

    expect(auth.workspace.id).toBe(VICTIM_WORKSPACE_ID);
    expect(notFound).not.toHaveBeenCalled();
  });

  test("404s when the caller pairs their own workspace with a foreign survey", async () => {
    // The cross-tenant read: authorization for the attacker's own workspace succeeds, but the
    // survey in the URL belongs to someone else.
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(ATTACKER_WORKSPACE_ID));
    mockPrismaSurvey.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);

    await expect(getSurveyAuth(ATTACKER_WORKSPACE_ID, SURVEY_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  test("404s when the survey does not exist", async () => {
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(ATTACKER_WORKSPACE_ID));
    mockPrismaSurvey.findUnique.mockResolvedValueOnce(null);

    await expect(getSurveyAuth(ATTACKER_WORKSPACE_ID, "survey_missing")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("propagates the workspace authorization failure instead of masking it as a 404", async () => {
    mockGetWorkspaceAuth.mockRejectedValueOnce(new Error("not authorized"));
    mockPrismaSurvey.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);

    await expect(getSurveyAuth(VICTIM_WORKSPACE_ID, SURVEY_ID)).rejects.toThrow("not authorized");
  });
});
