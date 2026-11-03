import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { getRequesterAttachmentExport } from "./requester-export";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));

const mockedCan = vi.mocked(can);

const row = { id: "export-1", surveyId: "survey-1", workspaceId: "ws-1", status: "completed" };

describe("getRequesterAttachmentExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.attachmentExport.findFirst.mockResolvedValue(row as never);
  });

  test("returns the requester's export while they can read its survey", async () => {
    mockedCan.mockResolvedValue(true);

    await expect(getRequesterAttachmentExport({ id: "export-1", userId: "user-1" })).resolves.toEqual(row);
    expect(prisma.attachmentExport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "export-1", requestedById: "user-1" } })
    );
    expect(mockedCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "survey.read", {
      type: "survey",
      id: "survey-1",
    });
  });

  test("hides the export once the requester lost access to the survey", async () => {
    mockedCan.mockResolvedValue(false);

    await expect(getRequesterAttachmentExport({ id: "export-1", userId: "user-1" })).resolves.toBeNull();
  });

  test("finds nothing for someone else's export, without an authorization check", async () => {
    prisma.attachmentExport.findFirst.mockResolvedValue(null);

    await expect(getRequesterAttachmentExport({ id: "export-1", userId: "user-2" })).resolves.toBeNull();
    expect(mockedCan).not.toHaveBeenCalled();
  });
});
