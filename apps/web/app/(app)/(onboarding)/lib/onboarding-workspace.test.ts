import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import { getUserWorkspaces, getWorkspaces } from "@/lib/workspace/service";
import { getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOnboardingWorkspaceContext, selectOldestWorkspace } from "./onboarding-workspace";

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
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
    vi.mocked(can).mockResolvedValue(true);
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

  test("throws when the user cannot manage the organization", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(getOnboardingWorkspaceContext({ userId: "user1", organizationId: "org1" })).rejects.toThrow(
      AuthorizationError
    );

    expect(can).toHaveBeenCalledWith({ type: "user", id: "user1" }, "organization.manage", {
      type: "organization",
      id: "org1",
    });
  });
});
