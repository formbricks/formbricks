import { describe, expect, test } from "vitest";
import type { TWorkflowSendEmailActionConfig } from "../types/actions/send-email";
import type { TWorkflowTriggerRunPayload } from "../types/runs";
import { resolveWorkflowEmail } from "./send-email";

const triggerPayload: TWorkflowTriggerRunPayload = {
  type: "response.completed",
  workspaceId: "cm9zr4wsp000508l8y6nh9r2v",
  surveyId: "cm9zr4mps000008l8btfy1vtz",
  responseId: "cm9zr4rsp000708l8bqccpfrx",
  endingCardId: "cm9zr4q7i000108l84gozfggr",
  data: {
    response: {
      email: "jane@example.com",
      score: 9,
      variables: { plan: "pro" },
      hiddenFields: { utm: "newsletter" },
    },
  },
  triggeredAt: "2026-06-09T12:01:00.000Z",
};

const baseConfig: TWorkflowSendEmailActionConfig = {
  to: "{{response.email}}",
  from: "noreply@example.com",
  replyTo: ["support@example.com"],
  subject: "Thanks for your response",
  body: "We received your response.",
  attachResponseData: false,
};

describe("resolveWorkflowEmail", () => {
  test("resolves to/subject/body placeholders and preserves from/replyTo", () => {
    const email = resolveWorkflowEmail(
      { ...baseConfig, subject: "Hi {{response.email}}", body: "Score {{response.score}}" },
      triggerPayload
    );

    expect(email).toEqual({
      to: "jane@example.com",
      from: "noreply@example.com",
      replyTo: ["support@example.com"],
      subject: "Hi jane@example.com",
      html: "Score 9",
      text: "Score 9",
      recipientValid: true,
    });
  });

  test("does not append response data when attachResponseData is off", () => {
    const email = resolveWorkflowEmail(baseConfig, triggerPayload);
    expect(email.html).toBe("We received your response.");
    expect(email.text).toBe("We received your response.");
  });

  test("appends response data, gating variables and hidden fields when disabled", () => {
    const email = resolveWorkflowEmail({ ...baseConfig, attachResponseData: true }, triggerPayload);

    expect(email.text).toContain("We received your response.");
    expect(email.text).toContain("email: jane@example.com");
    expect(email.text).toContain("score: 9");
    expect(email.text).not.toContain("variables");
    expect(email.text).not.toContain("hiddenFields");
  });

  test("includes variables and hidden fields when enabled", () => {
    const email = resolveWorkflowEmail(
      { ...baseConfig, attachResponseData: true, includeVariables: true, includeHiddenFields: true },
      triggerPayload
    );

    expect(email.text).toContain('variables: {"plan":"pro"}');
    expect(email.text).toContain('hiddenFields: {"utm":"newsletter"}');
  });

  test("falls back to empty string for a missing recipient path and marks it invalid", () => {
    const email = resolveWorkflowEmail({ ...baseConfig, to: "{{response.missing}}" }, triggerPayload);
    expect(email.to).toBe("");
    expect(email.recipientValid).toBe(false);
  });

  test("HTML-escapes respondent-controlled values interpolated into the html body", () => {
    const payload: TWorkflowTriggerRunPayload = {
      ...triggerPayload,
      data: { response: { email: "jane@example.com", comment: '<script>alert("xss")</script>' } },
    };
    const email = resolveWorkflowEmail({ ...baseConfig, body: "Comment: {{response.comment}}" }, payload);

    expect(email.html).toBe("Comment: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    // The plain-text alternative keeps the raw value.
    expect(email.text).toBe('Comment: <script>alert("xss")</script>');
  });

  test("HTML-escapes the appended response-data block", () => {
    const payload: TWorkflowTriggerRunPayload = {
      ...triggerPayload,
      data: { response: { email: "jane@example.com", note: "<img src=x onerror=alert(1)>" } },
    };
    const email = resolveWorkflowEmail({ ...baseConfig, attachResponseData: true }, payload);

    expect(email.html).toContain("note: &lt;img src=x onerror=alert(1)&gt;");
    expect(email.html).not.toContain("<img");
    expect(email.text).toContain("note: <img src=x onerror=alert(1)>");
  });

  test("marks a malformed resolved recipient invalid", () => {
    const payload: TWorkflowTriggerRunPayload = {
      ...triggerPayload,
      data: { response: { email: "not-an-email" } },
    };
    const email = resolveWorkflowEmail(baseConfig, payload);
    expect(email.recipientValid).toBe(false);
  });
});
