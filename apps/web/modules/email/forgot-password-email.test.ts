import { describe, expect, test } from "vitest";
import { renderForgotPasswordEmail } from "@formbricks/email";

const t = (key: string, replacements?: Record<string, string>): string => {
  if (key === "emails.forgot_password_email_link_valid_for_24_hours") {
    return `The link is valid for ${replacements?.minutes} minutes.`;
  }

  const translations: Record<string, string> = {
    "emails.forgot_password_email_heading": "Change password",
    "emails.forgot_password_email_text":
      "You have requested a link to change your password. You can do this by clicking the link below:",
    "emails.forgot_password_email_change_password": "Change password",
    "emails.forgot_password_email_did_not_request": "If you didn't request this, please ignore this email.",
    "emails.email_footer_text_1": "Have a great day!",
    "emails.email_footer_text_2": "The Formbricks Team",
    "emails.email_template_text_1": "This email was sent via Formbricks.",
  };

  return translations[key] ?? key;
};

describe("renderForgotPasswordEmail", () => {
  test("renders the configurable link lifetime in minutes", async () => {
    const html = await renderForgotPasswordEmail({
      verifyLink: "https://app.formbricks.com/auth/forgot-password/reset?token=test-token",
      linkValidityInMinutes: 30,
      t,
    });

    expect(html).toContain("The link is valid for 30 minutes.");
    expect(html).not.toContain("24 hours");
  });
});
