import { describe, expect, test } from "vitest";
import { renderAccountDeletionNotifyEmail } from "@formbricks/email";

const t = (key: string): string => {
  const translations: Record<string, string> = {
    "emails.account_deletion_email_heading": "Account deleted",
    "emails.account_deletion_email_text":
      "Your Formbricks account and all associated data have been permanently deleted. If you did not request this deletion, please contact our support team immediately.",
    "emails.email_footer_text_1": "Have a great day!",
    "emails.email_footer_text_2": "The Formbricks Team",
    "emails.email_template_text_1": "This email was sent via Formbricks.",
  };

  return translations[key] ?? key;
};

describe("renderAccountDeletionNotifyEmail", () => {
  test("renders the account deletion confirmation content", async () => {
    const html = await renderAccountDeletionNotifyEmail({ t });

    expect(html).toContain("Account deleted");
    expect(html).toContain("permanently deleted");
  });
});
