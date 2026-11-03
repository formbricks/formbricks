import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { sendAttachmentExportFailedEmail, sendAttachmentExportReadyEmail } from "@/modules/email";
import {
  NOTIFY_RETRY_DELAYS_MS,
  notifyAttachmentExportFailed,
  notifyAttachmentExportReady,
} from "./notify-requester";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/email", () => ({
  sendAttachmentExportReadyEmail: vi.fn(),
  sendAttachmentExportFailedEmail: vi.fn(),
}));

const mockedReady = vi.mocked(sendAttachmentExportReadyEmail);
const mockedFailed = vi.mocked(sendAttachmentExportFailedEmail);

const EXPORT_ID = "cm8cmpnjj000108jfdr9exp01";
const WORKSPACE_ID = "cm8cmpnjj000108jfdr9wks01";
const scope = { attachmentExportId: EXPORT_ID, workspaceId: WORKSPACE_ID };

const row = (requestedBy: { id: string; email: string; locale: string } | null) => ({
  requestedBy,
  survey: { id: "survey-1", name: "Mystery shopper visit" },
  workspace: { organizationId: "org-1" },
});

const requester = { id: "user-1", email: "shopper-lead@example.com", locale: "de-DE" };

describe("notifyAttachmentExportReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReady.mockResolvedValue(true);
  });

  test("emails the requester in their language, dated in the organization's time zone", async () => {
    prisma.attachmentExport.findFirst.mockResolvedValue(row(requester) as never);

    await notifyAttachmentExportReady({
      ...scope,
      archiveBytes: 5.7 * 1024 * 1024 * 1024,
      // Late on 2 February in UTC is already 3 February in Riyadh.
      expiresAt: new Date("2027-02-02T22:00:00.000Z"),
      truncated: true,
      timeZone: "Asia/Riyadh",
    });

    expect(prisma.attachmentExport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: EXPORT_ID, workspaceId: WORKSPACE_ID } })
    );
    expect(mockedReady).toHaveBeenCalledWith({
      userId: "user-1",
      email: "shopper-lead@example.com",
      locale: "de-DE",
      organizationId: "org-1",
      surveyId: "survey-1",
      surveyName: "Mystery shopper visit",
      attachmentExportId: EXPORT_ID,
      // `Intl` puts a no-break space between the number and the unit.
      archiveSize: "5,7\u00a0GB",
      expiryDate: "3. Februar 2027",
      truncated: true,
    });
  });

  test("sends nothing when the requester's account is gone", async () => {
    prisma.attachmentExport.findFirst.mockResolvedValue(row(null) as never);

    await notifyAttachmentExportReady({
      ...scope,
      archiveBytes: 1,
      expiresAt: new Date(),
      truncated: false,
      timeZone: "UTC",
    });

    expect(mockedReady).not.toHaveBeenCalled();
  });

  test("retries a send that threw, so a mail server hiccup still delivers the link", async () => {
    vi.useFakeTimers();
    prisma.attachmentExport.findFirst.mockResolvedValue(row(requester) as never);
    mockedReady.mockRejectedValueOnce(new Error("Connection timeout")).mockResolvedValueOnce(true);

    const run = notifyAttachmentExportReady({
      ...scope,
      archiveBytes: 1,
      expiresAt: new Date(),
      truncated: false,
      timeZone: "UTC",
    });
    await vi.runAllTimersAsync();
    await run;
    vi.useRealTimers();

    expect(mockedReady).toHaveBeenCalledTimes(2);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("logs a send that keeps failing instead of failing the finished export", async () => {
    vi.useFakeTimers();
    prisma.attachmentExport.findFirst.mockResolvedValue(row(requester) as never);
    mockedReady.mockRejectedValue(new Error("Incorrect SMTP credentials"));

    const run = notifyAttachmentExportReady({
      ...scope,
      archiveBytes: 1,
      expiresAt: new Date(),
      truncated: false,
      timeZone: "UTC",
    });
    await vi.runAllTimersAsync();
    await expect(run).resolves.toBeUndefined();
    vi.useRealTimers();

    // The first try plus one per retry delay.
    expect(mockedReady).toHaveBeenCalledTimes(NOTIFY_RETRY_DELAYS_MS.length + 1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentExportId: EXPORT_ID, outcome: "ready" }),
      "Failed to send attachment export email"
    );
  });

  test("does not retry when SMTP is not configured", async () => {
    prisma.attachmentExport.findFirst.mockResolvedValue(row(requester) as never);
    mockedReady.mockResolvedValue(false);

    await notifyAttachmentExportReady({
      ...scope,
      archiveBytes: 1,
      expiresAt: new Date(),
      truncated: false,
      timeZone: "UTC",
    });

    expect(mockedReady).toHaveBeenCalledOnce();
  });
});

describe("notifyAttachmentExportFailed", () => {
  test("points the requester back at the survey's responses", async () => {
    vi.clearAllMocks();
    mockedFailed.mockResolvedValue(true);
    prisma.attachmentExport.findFirst.mockResolvedValue(row(requester) as never);

    await notifyAttachmentExportFailed(scope);

    expect(mockedFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "shopper-lead@example.com",
        workspaceId: WORKSPACE_ID,
        surveyId: "survey-1",
        surveyName: "Mystery shopper visit",
      })
    );
  });
});
