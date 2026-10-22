import { notFound } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { getCreativesAccess } from "./access";
import { getCreativesRouteAuth } from "./route-auth";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/modules/workspaces/lib/utils", () => ({ getWorkspaceAuth: vi.fn() }));
vi.mock("./access", () => ({ getCreativesAccess: vi.fn() }));

const organizationId = "clorg123456789012345678901";
const workspaceId = "clws1234567890123456789012";
const auth = {
  organization: { id: organizationId },
  workspace: { id: workspaceId },
  isReadOnly: false,
} as unknown as Awaited<ReturnType<typeof getWorkspaceAuth>>;

describe("getCreativesRouteAuth", () => {
  beforeEach(() => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(auth);
  });

  test.each(["full", "windDown"] as const)(
    "hands the page the workspace auth and %s access",
    async (access) => {
      vi.mocked(getCreativesAccess).mockResolvedValue(access);

      expect(await getCreativesRouteAuth(workspaceId)).toMatchObject({ ...auth, creativesAccess: access });
      expect(getCreativesAccess).toHaveBeenCalledWith({ organizationId, workspaceId });
    }
  );

  test("is a 404 when the workspace has no access to Creatives", async () => {
    vi.mocked(getCreativesAccess).mockResolvedValue("none");

    await expect(getCreativesRouteAuth(workspaceId)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
