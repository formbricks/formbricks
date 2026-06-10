import { beforeEach, describe, expect, test, vi } from "vitest";
import { getOnboardingWorkspace } from "@/app/(app)/(onboarding)/lib/onboarding-workspace";
import { redirectIfOnboardingComplete } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";
import { getPostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
import { getOrganizationBillingWithReadThroughSync } from "@/modules/ee/billing/lib/organization-billing";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import Page from "./page";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
}));

vi.mock("@/app/(app)/(onboarding)/lib/onboarding-workspace", () => ({
  getOnboardingWorkspace: vi.fn(),
}));

vi.mock("@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete", () => ({
  redirectIfOnboardingComplete: vi.fn(),
}));

vi.mock("@/lib/posthog/get-feature-flag", () => ({
  getPostHogFeatureFlag: vi.fn(),
}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  getOrganizationBillingWithReadThroughSync: vi.fn(),
}));

vi.mock("@/modules/organization/lib/utils", () => ({
  getOrganizationAuth: vi.fn(),
}));

vi.mock("./components/select-plan-onboarding", () => ({
  SelectPlanOnboarding: () => null,
}));

const organizationId = "clorg1234567890123456789012";
const workspaceId = "clws12345678901234567890123";
const pageProps = {
  params: Promise.resolve({ organizationId }),
};

describe("plan onboarding page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizationAuth).mockResolvedValue({
      session: { user: { id: "user_1" } },
    } as any);
    vi.mocked(getOnboardingWorkspace).mockResolvedValue({ id: workspaceId } as any);
    vi.mocked(getOrganizationBillingWithReadThroughSync).mockResolvedValue(null);
    vi.mocked(getPostHogFeatureFlag).mockResolvedValue(undefined);
  });

  test("redirects to login when there is no session", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValue({ session: null } as any);

    await expect(Page(pageProps)).rejects.toThrow("NEXT_REDIRECT:/auth/login");
    expect(redirectIfOnboardingComplete).not.toHaveBeenCalled();
  });

  test("runs the surveys-exist guard for the onboarding workspace", async () => {
    vi.mocked(redirectIfOnboardingComplete).mockRejectedValue(
      new Error(`NEXT_REDIRECT:/workspaces/${workspaceId}/`)
    );

    await expect(Page(pageProps)).rejects.toThrow(`NEXT_REDIRECT:/workspaces/${workspaceId}/`);

    expect(getOnboardingWorkspace).toHaveBeenCalledWith("user_1", organizationId);
    expect(redirectIfOnboardingComplete).toHaveBeenCalledWith(workspaceId);
    expect(getOrganizationBillingWithReadThroughSync).not.toHaveBeenCalled();
  });

  test("renders the plan selection when onboarding is not complete", async () => {
    const result = await Page(pageProps);

    expect(redirectIfOnboardingComplete).toHaveBeenCalledWith(workspaceId);
    expect(result).toBeTruthy();
  });

  test("skips the guard when the organization has no workspace yet", async () => {
    vi.mocked(getOnboardingWorkspace).mockResolvedValue(undefined);

    const result = await Page(pageProps);

    expect(redirectIfOnboardingComplete).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  test("redirects users with an existing paid subscription to the survey step", async () => {
    vi.mocked(getOrganizationBillingWithReadThroughSync).mockResolvedValue({
      stripe: { plan: "pro" },
    } as any);

    await expect(Page(pageProps)).rejects.toThrow(
      `NEXT_REDIRECT:/organizations/${organizationId}/workspaces/new/survey`
    );
  });
});
