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
  isAISmartToolsEnabled: false,
};

const mockWorkspace = {
  id: "ws1",
  name: "My workspace",
  organizationId: "org1",
  createdAt: new Date("2024-01-02"),
};

const olderWorkspace = {
  id: "ws-old",
  name: "Acme Old",
  organizationId: "org1",
  createdAt: new Date("2024-01-01"),
};

describe("onboarding-workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" });
    vi.mocked(getAccessFlags).mockReturnValue({ isOwner: true, isManager: false });
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
      id: "ws-existing",
      name: "Acme",
      organizationId: "org1",
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
    vi.mocked(getAccessFlags).mockReturnValueOnce({ isOwner: false, isManager: false });

    await expect(getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" })).rejects.toThrow(
      AuthorizationError
    );
  });
});
