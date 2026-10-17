import { beforeEach, describe, expect, test, vi } from "vitest";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { authorizeCreativePage } from "./authorization";
import { findCreativeWorkspaceId } from "./repository";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/modules/workspaces/lib/utils", () => ({ getWorkspaceAuth: vi.fn() }));
vi.mock("./repository", () => ({ findCreativeWorkspaceId: vi.fn() }));

const workspaceId = "clws1234567890123456789012";
const creativeId = "clcr1234567890123456789012";

const memberAuth = (isReadOnly: boolean) =>
  ({ workspace: { id: workspaceId }, isReadOnly }) as unknown as Awaited<ReturnType<typeof getWorkspaceAuth>>;

describe("authorizeCreativePage", () => {
  beforeEach(() => {
    vi.mocked(findCreativeWorkspaceId).mockResolvedValue(workspaceId);
  });

  test("lets a member who can only read open the creative, read-only", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(memberAuth(true));

    expect(await authorizeCreativePage({ workspaceId, creativeId })).toMatchObject({ access: "read" });
  });

  test("lets a member who can write edit it", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(memberAuth(false));

    expect(await authorizeCreativePage({ workspaceId, creativeId })).toMatchObject({
      access: "readWrite",
    });
  });

  test("finds nothing for a creative of another workspace or none at all", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(memberAuth(false));

    vi.mocked(findCreativeWorkspaceId).mockResolvedValue("clotherworkspace0000000000");
    expect(await authorizeCreativePage({ workspaceId, creativeId })).toBeNull();

    vi.mocked(findCreativeWorkspaceId).mockResolvedValue(null);
    expect(await authorizeCreativePage({ workspaceId, creativeId })).toBeNull();
  });

  test("refuses whoever the workspace check refuses", async () => {
    vi.mocked(getWorkspaceAuth).mockRejectedValue(new Error("not authorized"));

    await expect(authorizeCreativePage({ workspaceId, creativeId })).rejects.toThrow("not authorized");
  });
});
