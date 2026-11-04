import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Session } from "@formbricks/types/auth";
import { authorizeAttachmentExportAccess } from "./authorize";
import { getRequesterAttachmentExport } from "./requester-export";

vi.mock("server-only", () => ({}));
vi.mock("./authorize", () => ({ authorizeAttachmentExportAccess: vi.fn() }));

const mockedAuthorize = vi.mocked(authorizeAttachmentExportAccess);

const row = { id: "export-1", surveyId: "survey-1", workspaceId: "ws-1", status: "completed" };
const session = { user: { id: "user-1" } } as Session;

describe("getRequesterAttachmentExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.attachmentExport.findFirst.mockResolvedValue(row as never);
  });

  test("returns the requester's export while the download route's gate lets them read its survey", async () => {
    mockedAuthorize.mockResolvedValue({ response: null } as never);

    await expect(getRequesterAttachmentExport({ id: "export-1", session })).resolves.toEqual(row);
    expect(prisma.attachmentExport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "export-1", requestedById: "user-1" } })
    );
    expect(mockedAuthorize).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: "survey-1", authentication: session })
    );
  });

  test("hides the export once the gate refuses the requester", async () => {
    mockedAuthorize.mockResolvedValue({ response: new Response(null, { status: 403 }) });

    await expect(getRequesterAttachmentExport({ id: "export-1", session })).resolves.toBeNull();
  });

  test("finds nothing for someone else's export, without asking the gate", async () => {
    prisma.attachmentExport.findFirst.mockResolvedValue(null);

    await expect(
      getRequesterAttachmentExport({ id: "export-1", session: { user: { id: "user-2" } } as Session })
    ).resolves.toBeNull();
    expect(mockedAuthorize).not.toHaveBeenCalled();
  });
});
