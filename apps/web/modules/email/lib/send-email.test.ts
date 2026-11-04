import { type Socket, createServer } from "node:net";
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
    SMTP_PASSWORD: undefined as string | undefined,
    SMTP_PORT: "1025",
    SMTP_REQUIRE_TLS: false,
    SMTP_REJECT_UNAUTHORIZED_TLS: true,
    SMTP_SECURE_ENABLED: false,
    SMTP_USER: undefined as string | undefined,
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

const startPlainSmtpServer = async () => {
  const commands: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8");
    socket.write("220 local test SMTP\r\n");
    let pending = "";
    let readingData = false;
    socket.on("data", (chunk: string) => {
      pending += chunk;
      while (pending.includes("\r\n")) {
        const lineEnd = pending.indexOf("\r\n");
        const line = pending.slice(0, lineEnd);
        pending = pending.slice(lineEnd + 2);
        if (readingData) {
          if (line === ".") {
            readingData = false;
            socket.write("250 accepted\r\n");
          }
          continue;
        }
        commands.push(line);
        if (line.startsWith("EHLO")) socket.write("250-localhost\r\n250 SIZE 100000\r\n");
        else if (line.startsWith("HELO")) socket.write("250 localhost\r\n");
        else if (line.startsWith("MAIL FROM") || line.startsWith("RCPT TO")) socket.write("250 OK\r\n");
        else if (line === "DATA") {
          readingData = true;
          socket.write("354 go ahead\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("502 unsupported\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SMTP test server has no port");
  return {
    port: address.port,
    commands,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
};

describe("sendEmail SES event publishing", () => {
  beforeEach(() => {
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.sendMail.mockResolvedValue({ messageId: "smtp-message-id" });
    mocks.constants.IS_SMTP_CONFIGURED = true;
    mocks.constants.SES_CONFIGURATION_SET = undefined;
    mocks.constants.SES_EMAIL_ENVIRONMENT = undefined;
    mocks.constants.SMTP_REQUIRE_TLS = false;
    mocks.constants.SMTP_SECURE_ENABLED = false;
    mocks.constants.SMTP_REJECT_UNAUTHORIZED_TLS = true;
    mocks.constants.SMTP_AUTHENTICATED = false;
    mocks.constants.SMTP_HOST = "localhost";
    mocks.constants.SMTP_PORT = "1025";
    mocks.constants.SMTP_USER = undefined;
    mocks.constants.SMTP_PASSWORD = undefined;
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

  test("requires STARTTLS for an explicit SMTP connection when opted in", async () => {
    mocks.constants.SMTP_REQUIRE_TLS = true;
    await sendEmail(email);
    expect(mocks.createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ requireTLS: true }));

    mocks.constants.SMTP_SECURE_ENABLED = true;
    await sendEmail(email);
    expect(mocks.createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ requireTLS: false }));
    mocks.constants.SMTP_SECURE_ENABLED = false;
  });

  test("refuses a server without STARTTLS before sending credentials or message data", async () => {
    const smtp = await startPlainSmtpServer();
    const nodemailer = await vi.importActual<typeof import("nodemailer")>("nodemailer");
    try {
      mocks.constants.SMTP_HOST = "127.0.0.1";
      mocks.constants.SMTP_PORT = String(smtp.port);
      mocks.constants.SMTP_REQUIRE_TLS = true;
      mocks.constants.SMTP_AUTHENTICATED = true;
      mocks.constants.SMTP_USER = "test-user";
      mocks.constants.SMTP_PASSWORD = "test-secret";
      mocks.createTransport.mockImplementationOnce((options) => nodemailer.createTransport(options));

      await expect(sendEmail(email)).rejects.toThrow("Incorrect SMTP credentials");
      expect(smtp.commands.some((command) => /^(AUTH|MAIL|RCPT|DATA)\b/i.test(command))).toBe(false);
      expect(smtp.commands.some((command) => /^EHLO\b/i.test(command))).toBe(true);
    } finally {
      await smtp.close();
    }
  });

  test("still sends through an unauthenticated plaintext local relay by default", async () => {
    const smtp = await startPlainSmtpServer();
    const nodemailer = await vi.importActual<typeof import("nodemailer")>("nodemailer");
    try {
      mocks.constants.SMTP_HOST = "127.0.0.1";
      mocks.constants.SMTP_PORT = String(smtp.port);
      mocks.createTransport.mockImplementationOnce((options) => nodemailer.createTransport(options));

      await expect(sendEmail(email)).resolves.toBe(true);
      expect(smtp.commands.some((command) => /^MAIL FROM\b/i.test(command))).toBe(true);
      expect(smtp.commands).toContain("DATA");
    } finally {
      await smtp.close();
    }
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

describe("sendEmail recipient guard (ENG-6658)", () => {
  beforeEach(() => {
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.sendMail.mockResolvedValue({ messageId: "smtp-message-id" });
    mocks.constants.IS_SMTP_CONFIGURED = true;
  });

  // nodemailer reads `to` as an address list: one invite must not reach several inboxes.
  test.each([
    "a@example.com, b@example.com",
    "a@example.com; b@example.com",
    '"Bob" <b@example.com>',
    "group: a@example.com, b@example.com;",
    "<a@example.com>",
    "a@b@example.com",
    `${"a".repeat(320)}@example.com`,
    "not-an-address",
  ])("refuses %j before opening a connection", async (to) => {
    await expect(sendEmail({ ...email, to })).rejects.toThrow("exactly one valid recipient");
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  // nodemailer delivers these to one inbox; refusing them (as an input comparison would) blocks valid mail.
  test.each(['"a b"@example.com', '"a@b"@example.com', "a@example.com,", "josé@bücher.example"])(
    "sends to one address the parser normalizes: %j",
    async (to) => {
      await expect(sendEmail({ ...email, to })).resolves.toBe(true);
    }
  );
});
