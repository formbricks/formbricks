import { beforeEach, describe, expect, test, vi } from "vitest";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { authorizeCreativePage } from "./authorization";
import { type TCreativeRecord, findCreativeRecord } from "./repository";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/modules/workspaces/lib/utils", () => ({ getWorkspaceAuth: vi.fn() }));
vi.mock("./repository", () => ({ findCreativeRecord: vi.fn(), findCreativeWorkspaceId: vi.fn() }));

const workspaceId = "clws1234567890123456789012";
const creativeId = "clcr1234567890123456789012";
const record = { id: creativeId, workspaceId } as unknown as TCreativeRecord;

const memberAuth = (isReadOnly: boolean) =>
  ({ workspace: { id: workspaceId }, isReadOnly }) as unknown as Awaited<ReturnType<typeof getWorkspaceAuth>>;

describe("authorizeCreativePage", () => {
  beforeEach(() => {
    vi.mocked(findCreativeRecord).mockResolvedValue(record);
  });

  test("lets a member who can only read open the creative, read-only", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(memberAuth(true));

    expect(await authorizeCreativePage({ workspaceId, creativeId })).toMatchObject({ access: "read" });
  });

  test("lets a member who can write edit it, with the creative read in that workspace", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(memberAuth(false));

    expect(await authorizeCreativePage({ workspaceId, creativeId })).toMatchObject({
      access: "readWrite",
      record,
    });
    expect(findCreativeRecord).toHaveBeenCalledWith(creativeId, workspaceId);
  });

  test("finds nothing for a creative of another workspace or none at all", async () => {
    vi.mocked(getWorkspaceAuth).mockResolvedValue(memberAuth(false));
    // The read is scoped to the workspace, so another workspace's creative reads as none.
    vi.mocked(findCreativeRecord).mockResolvedValue(null);

    expect(await authorizeCreativePage({ workspaceId, creativeId })).toBeNull();
  });

  test("refuses whoever the workspace check refuses", async () => {
    vi.mocked(getWorkspaceAuth).mockRejectedValue(new Error("not authorized"));

    await expect(authorizeCreativePage({ workspaceId, creativeId })).rejects.toThrow("not authorized");
  });
});
