import { beforeEach, describe, expect, test, vi } from "vitest";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getIsCreativesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getCreativesAccess } from "./access";
import { workspaceHasCreatives } from "./repository";

const { constants } = vi.hoisted(() => ({ constants: { IS_FORMBRICKS_CLOUD: false } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => constants);
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsCreativesEnabled: vi.fn() }));
vi.mock("./repository", () => ({ workspaceHasCreatives: vi.fn() }));

const organizationId = "clorg123456789012345678901";
const workspaceId = "clws1234567890123456789012";
const target = { organizationId, workspaceId };

describe("getCreativesAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    constants.IS_FORMBRICKS_CLOUD = false;
    vi.mocked(getIsCreativesEnabled).mockResolvedValue(false);
    vi.mocked(workspaceHasCreatives).mockResolvedValue(false);
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(organizationId);
  });

  test("is full when the licence includes Creatives, without looking at the workspace's creatives", async () => {
    vi.mocked(getIsCreativesEnabled).mockResolvedValue(true);

    expect(await getCreativesAccess(target)).toBe("full");
    expect(getIsCreativesEnabled).toHaveBeenCalledWith(organizationId);
    expect(workspaceHasCreatives).not.toHaveBeenCalled();
  });

  // `workspaceHasCreatives` counts archived creatives too (repository.integration.test.ts), so their
  // authors can still delete them.
  test("winds down on a self-hosted instance without Creatives whose workspace still has creatives", async () => {
    vi.mocked(workspaceHasCreatives).mockResolvedValue(true);

    expect(await getCreativesAccess(target)).toBe("windDown");
    expect(workspaceHasCreatives).toHaveBeenCalledWith(workspaceId);
  });

  test("is none on a self-hosted instance without Creatives and with no creatives to wind down", async () => {
    expect(await getCreativesAccess(target)).toBe("none");
  });

  test("is none on Cloud, even for a workspace that has creatives", async () => {
    constants.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(workspaceHasCreatives).mockResolvedValue(true);

    expect(await getCreativesAccess(target)).toBe("none");
  });

  test("looks the organization up when only the workspace is given", async () => {
    vi.mocked(getIsCreativesEnabled).mockResolvedValue(true);

    expect(await getCreativesAccess(workspaceId)).toBe("full");
    expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith(workspaceId);
    expect(getIsCreativesEnabled).toHaveBeenCalledWith(organizationId);
  });
});
