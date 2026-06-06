import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { InvalidInputError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getUserWorkspaces, getWorkspaces } from "@/lib/workspace/service";
import { getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import {
  ensureOnboardingWorkspace,
  resolveUniqueWorkspaceName,
  selectOldestWorkspace,
} from "./ensure-onboarding-workspace";

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

vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({
  createWorkspace: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn().mockResolvedValue((key: string) => key),
}));

const mockOrganization = {
  id: "org1",
  name: "Acme",
  isAISmartToolsEnabled: false,
};

const mockWorkspace = {
  id: "ws1",
  name: "Acme",
  organizationId: "org1",
  createdAt: new Date("2024-01-02"),
};

const olderWorkspace = {
  id: "ws-old",
  name: "Acme Old",
  organizationId: "org1",
  createdAt: new Date("2024-01-01"),
};

describe("ensureOnboardingWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as never);
    vi.mocked(getAccessFlags).mockReturnValue({ isOwner: true, isManager: false } as never);
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization as never);
    vi.mocked(getIsAISmartToolsEnabled).mockResolvedValue(true);
    vi.mocked(updateOrganization).mockResolvedValue({
      ...mockOrganization,
      isAISmartToolsEnabled: true,
    } as never);
    vi.mocked(getUserWorkspaces).mockResolvedValue([]);
    vi.mocked(getWorkspaces).mockResolvedValue([]);
    vi.mocked(createWorkspace).mockResolvedValue(mockWorkspace as never);
  });

  test("resolveUniqueWorkspaceName appends suffix when base name is taken", () => {
    expect(resolveUniqueWorkspaceName("Acme", ["Acme"])).toBe("Acme 2");
    expect(resolveUniqueWorkspaceName("Acme", ["Acme", "Acme 2"])).toBe("Acme 3");
  });

  test("selectOldestWorkspace returns the earliest workspace by createdAt", () => {
    expect(
      selectOldestWorkspace([{ ...mockWorkspace, createdAt: new Date("2024-02-01") }, olderWorkspace])
    ).toEqual(olderWorkspace);
  });

  test("returns existing workspace when present", async () => {
    vi.mocked(getUserWorkspaces).mockResolvedValueOnce([mockWorkspace] as never);

    const result = await ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" });

    expect(result).toEqual({
      workspace: mockWorkspace,
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
    });
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  test("reuses organization workspace when one already exists", async () => {
    const existingWorkspace = {
      id: "ws-existing",
      name: "Acme",
      organizationId: "org1",
      createdAt: new Date("2024-01-01"),
    };
    vi.mocked(getWorkspaces).mockResolvedValueOnce([existingWorkspace] as never);

    const result = await ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" });

    expect(result).toEqual({
      workspace: existingWorkspace,
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
    });
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  test("creates workspace when none exists", async () => {
    const result = await ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" });

    expect(createWorkspace).toHaveBeenCalledWith("org1", expect.objectContaining({ name: "Acme" }));
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "user1",
      "workspace_created",
      expect.objectContaining({ workspace_id: "ws1" }),
      expect.any(Object)
    );
    expect(result).toEqual({
      workspace: mockWorkspace,
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
    });
  });

  test("enables smart tools when entitled", async () => {
    await ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" });

    expect(updateOrganization).toHaveBeenCalledWith("org1", { isAISmartToolsEnabled: true });
  });

  test("skips org update when not entitled", async () => {
    vi.mocked(getIsAISmartToolsEnabled).mockResolvedValueOnce(false);

    await ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" });

    expect(updateOrganization).not.toHaveBeenCalled();
  });

  test("retries with suffixed name when create hits duplicate name race", async () => {
    const retryWorkspace = { id: "ws2", name: "Acme 2", organizationId: "org1" };
    vi.mocked(createWorkspace)
      .mockRejectedValueOnce(
        new InvalidInputError("A workspace with this name already exists in your organization")
      )
      .mockResolvedValueOnce(retryWorkspace as never);

    const result = await ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" });

    expect(createWorkspace).toHaveBeenNthCalledWith(1, "org1", expect.objectContaining({ name: "Acme" }));
    expect(createWorkspace).toHaveBeenNthCalledWith(2, "org1", expect.objectContaining({ name: "Acme 2" }));
    expect(result).toEqual({
      workspace: retryWorkspace,
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
    });
  });

  test("returns workspace created by parallel request after duplicate name error", async () => {
    const racedWorkspace = { id: "ws-race", name: "Acme", organizationId: "org1" };
    vi.mocked(createWorkspace).mockRejectedValueOnce(
      new InvalidInputError("A workspace with this name already exists in your organization")
    );
    vi.mocked(getWorkspaces)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([racedWorkspace] as never);

    const result = await ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" });

    expect(createWorkspace).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      workspace: racedWorkspace,
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
    });
  });

  test("returns isAISmartToolsEntitled false when organization is not entitled", async () => {
    vi.mocked(getIsAISmartToolsEnabled).mockResolvedValueOnce(false);

    const result = await ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" });

    expect(result.isAISmartToolsEntitled).toBe(false);
    expect(result.isAISmartToolsEnabled).toBe(false);
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  test("throws when user is not owner or manager", async () => {
    vi.mocked(getAccessFlags).mockReturnValueOnce({ isOwner: false, isManager: false } as never);

    await expect(ensureOnboardingWorkspace({ userId: "user1", organizationId: "org1" })).rejects.toThrow(
      AuthorizationError
    );
  });
});
