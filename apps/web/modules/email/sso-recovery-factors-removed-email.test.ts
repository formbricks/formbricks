import { describe, expect, test } from "vitest";
import { renderSsoRecoveryFactorsRemovedEmail } from "@formbricks/email";

const t = (key: string): string => {
  const translations: Record<string, string> = {
    "emails.sso_recovery_factors_removed_email_heading": "Sign-in factors removed from your account",
    "emails.sso_recovery_factors_removed_email_text":
      "You just signed in with single sign-on for the first time.",
    "emails.sso_recovery_factors_removed_email_password": "Your password was removed.",
    "emails.sso_recovery_factors_removed_email_two_factor": "Two-factor authentication was removed.",
    "emails.sso_recovery_factors_removed_email_sign_in_hint": "You can keep signing in with single sign-on.",
    "emails.sso_recovery_factors_removed_email_review_security": "Review security settings",
    "emails.sso_recovery_factors_removed_email_did_not_expect":
      "If you did not just sign in, contact support.",
    "emails.email_footer_text_1": "Have a great day!",
    "emails.email_footer_text_2": "The Formbricks Team",
    "emails.email_template_text_1": "This email was sent via Formbricks.",
  };
  return translations[key] ?? key;
};

/**
 * ENG-2633. This mail exists to tell someone their password or second factor is gone, so the two things
 * that must hold are that it names only what was actually removed, and that the place it sends them to
 * re-enrol is real. A smoke test caught the link 404ing (`/settings/security` does not exist); that is
 * what the last test here pins.
 */
describe("renderSsoRecoveryFactorsRemovedEmail", () => {
  const render = (overrides: { passwordRemoved: boolean; twoFactorRemoved: boolean }) =>
    renderSsoRecoveryFactorsRemovedEmail({
      securitySettingsLink: "https://app.formbricks.com/account/settings/profile",
      t,
      ...overrides,
    });

  test("names both factors when both were removed", async () => {
    const html = await render({ passwordRemoved: true, twoFactorRemoved: true });

    expect(html).toContain("Your password was removed.");
    expect(html).toContain("Two-factor authentication was removed.");
  });

  // Claiming a factor was removed that the user never had would be alarming and wrong.
  test("omits the second factor when only the password was removed", async () => {
    const html = await render({ passwordRemoved: true, twoFactorRemoved: false });

    expect(html).toContain("Your password was removed.");
    expect(html).not.toContain("Two-factor authentication was removed.");
  });

  test("omits the password when only the second factor was removed", async () => {
    const html = await render({ passwordRemoved: false, twoFactorRemoved: true });

    expect(html).not.toContain("Your password was removed.");
    expect(html).toContain("Two-factor authentication was removed.");
  });

  /**
   * The re-enrolment link is the whole point of the mail — a dead one leaves the user with a factor
   * removed and nowhere to go. `/account/settings/profile` is the page that hosts both the password
   * form and the 2FA card; there is no `/settings/security` route, which is what shipped first.
   */
  test("links to the account page that actually hosts both factors", async () => {
    const html = await render({ passwordRemoved: true, twoFactorRemoved: true });

    expect(html).toContain("https://app.formbricks.com/account/settings/profile");
    expect(html).not.toContain("/settings/security");
  });
});
