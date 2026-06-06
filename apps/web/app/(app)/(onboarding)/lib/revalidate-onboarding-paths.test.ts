import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { revalidateOnboardingWorkspacePaths } from "./revalidate-onboarding-paths";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("revalidateOnboardingWorkspacePaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("revalidates the onboarding workspace pages", () => {
    revalidateOnboardingWorkspacePaths("org1");

    expect(revalidatePath).toHaveBeenCalledWith("/organizations/org1/workspaces/new", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/organizations/org1/workspaces/new/survey");
    expect(revalidatePath).toHaveBeenCalledWith("/organizations/org1/workspaces/new/ai");
    expect(revalidatePath).toHaveBeenCalledWith("/organizations/org1/workspaces/new/templates");
    expect(revalidatePath).toHaveBeenCalledWith("/organizations/org1/workspaces/new/plan");
  });
});
