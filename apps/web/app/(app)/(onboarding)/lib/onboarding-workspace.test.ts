import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import { getUserWorkspaces, getWorkspaces } from "@/lib/workspace/service";
import { getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOnboardingWorkspaceContext, selectOldestWorkspace } from "./onboarding-workspace";

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
  updateOrganization: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsAISmartToolsEnabled: vi.fn(),
}));

vi.mock("@/lib/workspace/service", () => ({
  getUserWorkspaces: vi.fn(),
  getWorkspaces: vi.fn(),
}));

const mockOrganization = {
  id: "org1",
  name: "Acme",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  billing: {
    stripeCustomerId: null,
    limits: {
      workspaces: 3,
      monthly: {
        responses: 1500,
      },
    },
    usageCycleAnchor: null,
  },
  isAISmartToolsEnabled: false,
};

const baseWorkspace = {
  organizationId: "org1",
  updatedAt: new Date("2024-01-02"),
  styling: { allowStyleOverwrite: true },
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  config: { channel: null, industry: null },
  placement: "bottomRight" as const,
  clickOutsideClose: false,
  overlay: "none" as const,
  languages: [],
  appSetupCompleted: false,
  logo: null,
};

const mockWorkspace = {
  ...baseWorkspace,
  id: "ws1",
  name: "My workspace",
  createdAt: new Date("2024-01-02"),
};

const olderWorkspace = {
  ...baseWorkspace,
  id: "ws-old",
  name: "Acme Old",
  createdAt: new Date("2024-01-01"),
};

describe("onboarding-workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({
      organizationId: "org1",
      userId: "user1",
      accepted: true,
      role: "owner",
    });
    vi.mocked(getAccessFlags).mockReturnValue({
      isOwner: true,
      isManager: false,
      isBilling: false,
      isMember: false,
    });
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization);
    vi.mocked(getIsAISmartToolsEnabled).mockResolvedValue(true);
    vi.mocked(updateOrganization).mockResolvedValue({
      ...mockOrganization,
      isAISmartToolsEnabled: true,
    });
    vi.mocked(getUserWorkspaces).mockResolvedValue([]);
    vi.mocked(getWorkspaces).mockResolvedValue([]);
  });

  test("selectOldestWorkspace returns the earliest workspace by createdAt", () => {
    expect(
      selectOldestWorkspace([{ ...mockWorkspace, createdAt: new Date("2024-02-01") }, olderWorkspace])
    ).toEqual(olderWorkspace);
  });

  test("returns existing user workspace when present", async () => {
    vi.mocked(getUserWorkspaces).mockResolvedValueOnce([mockWorkspace]);

    const result = await getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" });

    expect(result).toEqual({
      workspace: mockWorkspace,
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
    });
  });

  test("reuses organization workspace when one already exists", async () => {
    const existingWorkspace = {
      ...baseWorkspace,
      id: "ws-existing",
      name: "Acme",
      createdAt: new Date("2024-01-01"),
    };
    vi.mocked(getWorkspaces).mockResolvedValueOnce([existingWorkspace]);

    const result = await getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" });

    expect(result).toEqual({
      workspace: existingWorkspace,
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
    });
  });

  test("throws when no onboarding workspace exists", async () => {
    await expect(getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" })).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  test("enables smart tools when entitled", async () => {
    vi.mocked(getUserWorkspaces).mockResolvedValueOnce([mockWorkspace]);

    await getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" });

    expect(updateOrganization).toHaveBeenCalledWith("org1", { isAISmartToolsEnabled: true });
  });

  test("skips org update when not entitled", async () => {
    vi.mocked(getIsAISmartToolsEnabled).mockResolvedValueOnce(false);
    vi.mocked(getUserWorkspaces).mockResolvedValueOnce([mockWorkspace]);

    await getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" });

    expect(updateOrganization).not.toHaveBeenCalled();
  });

  test("returns isAISmartToolsEntitled false when organization is not entitled", async () => {
    vi.mocked(getIsAISmartToolsEnabled).mockResolvedValueOnce(false);
    vi.mocked(getUserWorkspaces).mockResolvedValueOnce([mockWorkspace]);

    const result = await getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" });

    expect(result.isAISmartToolsEntitled).toBe(false);
    expect(result.isAISmartToolsEnabled).toBe(false);
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  test("throws when user is not owner or manager", async () => {
    vi.mocked(getAccessFlags).mockReturnValueOnce({
      isOwner: false,
      isManager: false,
      isBilling: false,
      isMember: false,
    });

    await expect(getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" })).rejects.toThrow(
      AuthorizationError
    );
  });
});
