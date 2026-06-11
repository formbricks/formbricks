import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { sendAccountDeletionEmail } from "@/modules/email";
import { queueAccountDeletionEmailBackground } from "./account-deletion-email";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/modules/email", () => ({
  sendAccountDeletionEmail: vi.fn(),
}));

const user = {
  email: "deleted-user@example.com",
  locale: "en-US" as const,
  userId: "user-id",
};

describe("queueAccountDeletionEmailBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends the account deletion email in the background", async () => {
    vi.mocked(sendAccountDeletionEmail).mockResolvedValueOnce(true);

    queueAccountDeletionEmailBackground(user);

    expect(sendAccountDeletionEmail).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(sendAccountDeletionEmail).toHaveBeenCalledWith({
        email: user.email,
        locale: user.locale,
      });
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("logs the error without throwing when email delivery fails", async () => {
    const emailError = new Error("Email provider is down");
    vi.mocked(sendAccountDeletionEmail).mockRejectedValueOnce(emailError);

    expect(() => {
      queueAccountDeletionEmailBackground(user);
    }).not.toThrow();

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        { error: emailError, userId: user.userId },
        "Failed to send account deletion confirmation email"
      );
    });
  });
});
