import { describe, expect, test } from "vitest";
import { renderAccountDeletedEmail } from "@formbricks/email";

const translations: Record<string, string> = {
  "emails.account_deleted_email_heading": "Your account has been deleted",
  "emails.account_deleted_email_text": "Your Formbricks account has been permanently removed.",
  "emails.account_deleted_email_did_not_request":
    "If you did not delete your account, please contact support immediately.",
};

const t = (key: string): string => translations[key] ?? key;

describe("renderAccountDeletedEmail", () => {
  test("tells the user the account is gone, with no link to act on", async () => {
    const html = await renderAccountDeletedEmail({ t });

    expect(html).toContain("Your account has been deleted");
    expect(html).toContain("Your Formbricks account has been permanently removed.");
    expect(html).toContain("please contact support immediately");
    // A deleted account has nothing left to sign in to or confirm.
    expect(html).not.toMatch(/<a\s[^>]*href="https?:\/\/[^"]*(?:auth|delete-user|token)/i);
  });
});
