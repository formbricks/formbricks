import type { CapturedNetworkRequest } from "posthog-js";
import { describe, expect, test } from "vitest";
import { maskWebhookNetworkRequests } from "./mask-webhook-network-requests";

const TOKEN = "q8Zk3vT1xN2yR5wP7mC4bA";
const WORKFLOW_URL = "https://app.example.com/api/v3/workflows/cm9zr4t2b000208l8h2m1aq3c";
const SECRET_URL = `${WORKFLOW_URL}/webhook/${TOKEN}`;

const request = (name: string): CapturedNetworkRequest => ({
  name,
  entryType: "resource",
  startTime: 1,
  duration: 2,
  method: "GET",
  status: 200,
  requestHeaders: { accept: "application/json" },
  requestBody: null,
  responseHeaders: { "content-type": "application/json" },
  responseBody: JSON.stringify({ data: { url: SECRET_URL } }),
});

describe("maskWebhookNetworkRequests", () => {
  test.each([`${WORKFLOW_URL}/webhook`, `${WORKFLOW_URL}/webhook/regenerate`, `${WORKFLOW_URL}/webhook?x=1`])(
    "drops headers and bodies of %s, keeping its timing",
    (url) => {
      const masked = maskWebhookNetworkRequests(request(url));

      expect(JSON.stringify(masked)).not.toContain(TOKEN);
      expect(masked).toMatchObject({ name: url, status: 200, startTime: 1, duration: 2 });
      expect(masked.requestHeaders).toBeUndefined();
      expect(masked.responseHeaders).toBeUndefined();
      expect(masked.requestBody).toBeNull();
      expect(masked.responseBody).toBeNull();
    }
  );

  test("redacts the token when the Secret URL itself is the request", () => {
    const masked = maskWebhookNetworkRequests(request(SECRET_URL));

    expect(masked.name).toBe(`${WORKFLOW_URL}/webhook/[redacted]`);
    expect(JSON.stringify(masked)).not.toContain(TOKEN);
  });

  test("leaves other requests as they are", () => {
    const original = request(`${WORKFLOW_URL}/runs`);

    expect(maskWebhookNetworkRequests(original)).toEqual(original);
  });
});
