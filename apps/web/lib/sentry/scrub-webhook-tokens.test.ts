import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, test } from "vitest";
import { scrubWebhookTokens } from "./scrub-webhook-tokens";

const TOKEN = "q8Zk3vT1xN2yR5wP7mC4bA";
const PATH = `/api/v3/workflows/cm9zr4t2b000208l8h2m1aq3c/webhook/${TOKEN}`;

describe("scrubWebhookTokens", () => {
  test("removes the token from every part of an event that can carry a request path", () => {
    const event = {
      transaction: `POST ${PATH}`,
      request: { url: `https://app.example.com${PATH}`, headers: { referer: `https://x.test${PATH}` } },
      exception: { values: [{ type: "Error", value: `fetch ${PATH} failed` }] },
      breadcrumbs: [{ category: "http", data: { url: PATH }, message: `POST ${PATH}` }],
      tags: { path: PATH },
      extra: { nested: [{ deep: { url: PATH } }] },
      contexts: { trace: { data: { "http.target": PATH } } },
    } as unknown as ErrorEvent;

    const scrubbed = scrubWebhookTokens(event);

    expect(JSON.stringify(scrubbed)).not.toContain(TOKEN);
    expect(scrubbed.request?.url).toBe(
      "https://app.example.com/api/v3/workflows/cm9zr4t2b000208l8h2m1aq3c/webhook/[redacted]"
    );
  });

  test("leaves an event without a Secret URL untouched", () => {
    const event = { transaction: "GET /api/v3/surveys", tags: { a: 1 } } as unknown as ErrorEvent;

    expect(scrubWebhookTokens(event)).toEqual(event);
  });
});
