import { beforeEach, describe, expect, test, vi } from "vitest";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { deleteFile } from "@/modules/storage/service";
import { deleteResponseFileUrls } from "./delete-response-files";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: vi.fn(),
}));

vi.mock("@/modules/storage/service", () => ({
  deleteFile: vi.fn(),
}));

const mockedResolve = vi.mocked(findWorkspaceByIdOrLegacyEnvId);
const mockedDeleteFile = vi.mocked(deleteFile);

const OWN_WORKSPACE = "ws-own";
const FOREIGN_WORKSPACE = "ws-victim";

describe("deleteResponseFileUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDeleteFile.mockResolvedValue({ ok: true, data: undefined } as any);
  });

  test("deletes a file whose URL storage id belongs to the survey's workspace", async () => {
    mockedResolve.mockResolvedValue({ id: OWN_WORKSPACE, organizationId: "org-1" });

    await deleteResponseFileUrls([`/storage/${OWN_WORKSPACE}/private/answer.png`], OWN_WORKSPACE);

    expect(mockedDeleteFile).toHaveBeenCalledTimes(1);
    expect(mockedDeleteFile).toHaveBeenCalledWith(OWN_WORKSPACE, "private", "answer.png", OWN_WORKSPACE);
  });

  // The core cross-tenant guard: a planted URL pointing into another tenant's storage prefix must not be
  // deleted, even though it survived write-time validation via the element-id flip TOCTOU.
  test("refuses to delete a planted URL that resolves to a different workspace", async () => {
    mockedResolve.mockResolvedValue({ id: FOREIGN_WORKSPACE, organizationId: "org-2" });

    await deleteResponseFileUrls([`/storage/${FOREIGN_WORKSPACE}/public/bg--fid--uuid.png`], OWN_WORKSPACE);

    expect(mockedDeleteFile).not.toHaveBeenCalled();
  });

  // Legacy uploads were prefixed with the environment id; the resolver maps that back to the owning
  // workspace, so a same-workspace legacy prefix is still deletable — using its real (legacy) prefix.
  test("allows a legacy environment-id prefix that maps back to the survey's workspace", async () => {
    const legacyEnvId = "env-legacy";
    mockedResolve.mockResolvedValue({ id: OWN_WORKSPACE, organizationId: "org-1" });

    await deleteResponseFileUrls([`/storage/${legacyEnvId}/private/old.png`], OWN_WORKSPACE);

    expect(mockedResolve).toHaveBeenCalledWith(legacyEnvId);
    expect(mockedDeleteFile).toHaveBeenCalledWith(legacyEnvId, "private", "old.png", OWN_WORKSPACE);
  });

  test("refuses when the storage id resolves to no workspace", async () => {
    mockedResolve.mockResolvedValue(null);

    await deleteResponseFileUrls(["/storage/ws-unknown/public/x.png"], OWN_WORKSPACE);

    expect(mockedDeleteFile).not.toHaveBeenCalled();
  });

  test("deletes nothing and never resolves when no survey workspace id is given", async () => {
    await deleteResponseFileUrls([`/storage/${OWN_WORKSPACE}/private/answer.png`], undefined);

    expect(mockedResolve).not.toHaveBeenCalled();
    expect(mockedDeleteFile).not.toHaveBeenCalled();
  });

  test("skips an unparseable URL without throwing", async () => {
    await deleteResponseFileUrls(["not-a-storage-url"], OWN_WORKSPACE);

    expect(mockedResolve).not.toHaveBeenCalled();
    expect(mockedDeleteFile).not.toHaveBeenCalled();
  });

  test("in a mixed batch, deletes the owned file and refuses the foreign one", async () => {
    mockedResolve.mockImplementation(async (id: string) =>
      id === OWN_WORKSPACE
        ? { id: OWN_WORKSPACE, organizationId: "org-1" }
        : { id: id, organizationId: "org-2" }
    );

    await deleteResponseFileUrls(
      [`/storage/${OWN_WORKSPACE}/private/mine.png`, `/storage/${FOREIGN_WORKSPACE}/public/theirs.png`],
      OWN_WORKSPACE
    );

    expect(mockedDeleteFile).toHaveBeenCalledTimes(1);
    expect(mockedDeleteFile).toHaveBeenCalledWith(OWN_WORKSPACE, "private", "mine.png", OWN_WORKSPACE);
  });
});
