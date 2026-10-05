import { beforeEach, describe, expect, test, vi } from "vitest";
import { sendEmail } from "./send-email";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  constants: {
    DEBUG: false,
    IS_SMTP_CONFIGURED: true,
    MAIL_FROM: "hola@example.com",
    MAIL_FROM_NAME: "Formbricks",
    SES_CONFIGURATION_SET: undefined as string | undefined,
    SES_EMAIL_ENVIRONMENT: undefined as string | undefined,
    SMTP_AUTHENTICATED: false,
    SMTP_HOST: "localhost",
    SMTP_PASSWORD: undefined,
    SMTP_PORT: "1025",
    SMTP_REJECT_UNAUTHORIZED_TLS: true,
    SMTP_SECURE_ENABLED: false,
    SMTP_USER: undefined,
  },
}));

vi.mock("@/lib/constants", () => mocks.constants);
vi.mock("nodemailer", () => ({
  createTransport: mocks.createTransport,
}));

const email = {
  emailType: "invite" as const,
  to: "recipient@example.com",
  subject: "Invitation",
  html: "<p>Join</p>",
};

describe("sendEmail SES event publishing", () => {
  beforeEach(() => {
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.sendMail.mockResolvedValue({ messageId: "smtp-message-id" });
    mocks.constants.IS_SMTP_CONFIGURED = true;
    mocks.constants.SES_CONFIGURATION_SET = undefined;
    mocks.constants.SES_EMAIL_ENVIRONMENT = undefined;
  });

  test("keeps ordinary SMTP messages free of SES headers and internal metadata", async () => {
    expect(await sendEmail(email)).toBe(true);
    expect(mocks.sendMail).toHaveBeenCalledWith({
      to: email.to,
      subject: email.subject,
      html: email.html,
      from: "Formbricks <hola@example.com>",
    });
  });

  test("preserves SMTP TLS options with a numeric transport port", async () => {
    await sendEmail(email);
    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 1025,
        secure: false,
        tls: { rejectUnauthorized: true },
      })
    );
    mocks.constants.SMTP_SECURE_ENABLED = true;
    await sendEmail(email);
    expect(mocks.createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ secure: true }));
    mocks.constants.SMTP_SECURE_ENABLED = false;
  });

  test("adds the invite category and deployment to SES SMTP headers", async () => {
    mocks.constants.SES_CONFIGURATION_SET = "formbricks-email-config";
    mocks.constants.SES_EMAIL_ENVIRONMENT = "production_eu";

    await sendEmail(email);

    expect(mocks.sendMail.mock.calls[0][0]).toEqual({
      to: email.to,
      subject: email.subject,
      html: email.html,
      from: "Formbricks <hola@example.com>",
      headers: {
        "X-SES-CONFIGURATION-SET": "formbricks-email-config",
        "X-SES-MESSAGE-TAGS": "email_type=invite, environment=production_eu",
      },
    });
  });

  test("preserves workflow identity, sender and reply address with tagging enabled", async () => {
    mocks.constants.SES_CONFIGURATION_SET = "formbricks-email-config";
    mocks.constants.SES_EMAIL_ENVIRONMENT = "production_ksa";
    await sendEmail({
      ...email,
      emailType: "workflow_email",
      from: "custom@example.com",
      replyTo: "reply@example.com",
      messageId: "<workflow-step@example.com>",
      text: "Workflow body",
    });

    expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({
      from: "custom@example.com",
      replyTo: "reply@example.com",
      messageId: "<workflow-step@example.com>",
      text: "Workflow body",
      headers: { "X-SES-MESSAGE-TAGS": "email_type=workflow_email, environment=production_ksa" },
    });
    expect(mocks.sendMail.mock.calls[0][0]).not.toHaveProperty("emailType");
  });

  test("serializes the invite tags as SES headers in the SMTP MIME message", async () => {
    const nodemailer = await vi.importActual<typeof import("nodemailer")>("nodemailer");
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    mocks.sendMail.mockImplementationOnce((options) => transport.sendMail(options));
    mocks.constants.SES_CONFIGURATION_SET = "formbricks-email-config";
    mocks.constants.SES_EMAIL_ENVIRONMENT = "staging";

    await sendEmail(email);

    const result = await mocks.sendMail.mock.results[0].value;
    const message = result.message.toString();
    expect(message).toMatch(/^X-SES-CONFIGURATION-SET: formbricks-email-config\r?$/im);
    expect(message).toMatch(/^X-SES-MESSAGE-TAGS: email_type=invite, environment=staging\r?$/im);
    expect(message).toContain("To: recipient@example.com");
  });

  test("skips unconfigured SMTP", async () => {
    mocks.constants.IS_SMTP_CONFIGURED = false;
    expect(await sendEmail(email)).toBe(false);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  test("preserves the existing SMTP failure contract", async () => {
    mocks.sendMail.mockRejectedValue(new Error("SMTP failed"));
    await expect(sendEmail(email)).rejects.toThrow("Incorrect SMTP credentials");
  });
});
