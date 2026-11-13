import { describe, expect, test } from "vitest";
import { redactWebhookTokens } from "./redact-webhook-token";

const TOKEN = "q8Zk3vT1xN2yR5wP7mC4bA";
const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";

describe("redactWebhookTokens", () => {
  test.each([
    [
      `/api/v3/workflows/${WORKFLOW_ID}/webhook/${TOKEN}`,
      `/api/v3/workflows/${WORKFLOW_ID}/webhook/[redacted]`,
    ],
    [
      `https://app.example.com/api/v3/workflows/${WORKFLOW_ID}/webhook/${TOKEN}?x=1`,
      `https://app.example.com/api/v3/workflows/${WORKFLOW_ID}/webhook/[redacted]?x=1`,
    ],
    [
      `/base/api/v3/workflows/${WORKFLOW_ID}/webhook/${TOKEN}/`,
      `/base/api/v3/workflows/${WORKFLOW_ID}/webhook/[redacted]/`,
    ],
    [
      `POST /api/v3/workflows/${WORKFLOW_ID}/webhook/${TOKEN} failed`,
      `POST /api/v3/workflows/${WORKFLOW_ID}/webhook/[redacted] failed`,
    ],
  ])("replaces the token in %s", (input, expected) => {
    expect(redactWebhookTokens(input)).toBe(expected);
  });

  test.each([
    `/api/v3/workflows/${WORKFLOW_ID}/webhook`,
    `/api/v3/workflows/${WORKFLOW_ID}/webhook/regenerate`,
    `/api/v3/workflows/${WORKFLOW_ID}/sample`,
    "/api/v3/surveys/abc/webhook/xyz",
  ])("leaves %s alone", (input) => {
    expect(redactWebhookTokens(input)).toBe(input);
  });
});
