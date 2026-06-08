import { redirect } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TWorkspace } from "@formbricks/types/workspace";
import { getSurveyCount } from "@/lib/survey/service";
import { getOnboardingRedirectPath, redirectIfOnboardingComplete } from "./redirect-if-onboarding-complete";

const constantsMock = vi.hoisted(() => ({
  isFormbricksCloud: false,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return constantsMock.isFormbricksCloud;
  },
}));

vi.mock("@/lib/survey/service", () => ({
  getSurveyCount: vi.fn(),
}));

const mockWorkspace: TWorkspace = {
  id: "ws1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  name: "My Workspace",
  organizationId: "org1",
  styling: {},
  config: { channel: "link", industry: null },
} as TWorkspace;

describe("redirectIfOnboardingComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not redirect when workspace has no surveys", async () => {
    vi.mocked(getSurveyCount).mockResolvedValue(0);

    await redirectIfOnboardingComplete("ws1");

    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects to workspace survey list when surveys exist", async () => {
    vi.mocked(getSurveyCount).mockResolvedValue(1);

    await redirectIfOnboardingComplete("ws1");

    expect(redirect).toHaveBeenCalledWith("/workspaces/ws1/");
  });
});

describe("getOnboardingRedirectPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    constantsMock.isFormbricksCloud = false;
  });

  test("returns null when no onboarding workspace is provided", async () => {
    const result = await getOnboardingRedirectPath({
      organizationId: "org1",
      workspace: undefined,
    });

    expect(result).toBeNull();
    expect(getSurveyCount).not.toHaveBeenCalled();
  });

  test("returns survey onboarding path when workspace has no surveys", async () => {
    vi.mocked(getSurveyCount).mockResolvedValue(0);

    const result = await getOnboardingRedirectPath({
      organizationId: "org1",
      workspace: mockWorkspace,
    });

    expect(result).toBe("/organizations/org1/workspaces/new/survey");
    expect(getSurveyCount).toHaveBeenCalledWith("ws1");
  });

  test("returns plan onboarding path for cloud when workspace has no surveys", async () => {
    constantsMock.isFormbricksCloud = true;
    vi.mocked(getSurveyCount).mockResolvedValue(0);

    const result = await getOnboardingRedirectPath({
      organizationId: "org1",
      workspace: mockWorkspace,
    });

    expect(result).toBe("/organizations/org1/workspaces/new/plan");
    expect(getSurveyCount).toHaveBeenCalledWith("ws1");
  });

  test("returns null when workspace already has surveys", async () => {
    vi.mocked(getSurveyCount).mockResolvedValue(2);

    const result = await getOnboardingRedirectPath({
      organizationId: "org1",
      workspace: mockWorkspace,
    });

    expect(result).toBeNull();
  });
});
