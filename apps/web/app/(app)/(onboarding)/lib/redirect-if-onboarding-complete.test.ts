import { redirect } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSurveyCount } from "@/lib/survey/service";
import { getOnboardingWorkspace } from "./ensure-onboarding-workspace";
import {
  getOnboardingSurveyRedirectPath,
  redirectIfOnboardingComplete,
} from "./redirect-if-onboarding-complete";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurveyCount: vi.fn(),
}));

vi.mock("./ensure-onboarding-workspace", () => ({
  getOnboardingWorkspace: vi.fn(),
}));

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

describe("getOnboardingSurveyRedirectPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when no onboarding workspace exists", async () => {
    vi.mocked(getOnboardingWorkspace).mockResolvedValue(undefined);

    const result = await getOnboardingSurveyRedirectPath({
      userId: "user1",
      organizationId: "org1",
    });

    expect(result).toBeNull();
    expect(getSurveyCount).not.toHaveBeenCalled();
  });

  test("returns survey onboarding path when workspace has no surveys", async () => {
    vi.mocked(getOnboardingWorkspace).mockResolvedValue({
      id: "ws1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      name: "My Workspace",
      organizationId: "org1",
      styling: {},
      config: { channel: "link", industry: null },
    });
    vi.mocked(getSurveyCount).mockResolvedValue(0);

    const result = await getOnboardingSurveyRedirectPath({
      userId: "user1",
      organizationId: "org1",
    });

    expect(result).toBe("/organizations/org1/workspaces/new/survey");
    expect(getSurveyCount).toHaveBeenCalledWith("ws1");
  });

  test("returns null when workspace already has surveys", async () => {
    vi.mocked(getOnboardingWorkspace).mockResolvedValue({
      id: "ws1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      name: "My Workspace",
      organizationId: "org1",
      styling: {},
      config: { channel: "link", industry: null },
    });
    vi.mocked(getSurveyCount).mockResolvedValue(2);

    const result = await getOnboardingSurveyRedirectPath({
      userId: "user1",
      organizationId: "org1",
    });

    expect(result).toBeNull();
  });
});
