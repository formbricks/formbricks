import { describe, expect, test } from "vitest";
import { WORKFLOW_SECRET_MASK } from "@formbricks/workflows";
import { collectSentSecretValues, summarizeWorkflowHttpResponse } from "./request";
import type { WorkflowHttpResponse } from "./send-http-request";

const echo = (body: unknown): WorkflowHttpResponse => ({
  status: 200,
  contentType: "application/json",
  bodyText: JSON.stringify(body),
  truncated: false,
});

describe("summarizeWorkflowHttpResponse", () => {
  test("masks a secret header value the endpoint echoes back in what run detail and samples keep", () => {
    const response = echo({ headers: { "X-Api-Key": "sk-live-123456" }, ok: true });

    const { record, variables } = summarizeWorkflowHttpResponse(response, ["sk-live-123456"]);

    expect(JSON.stringify(record)).not.toContain("sk-live-123456");
    expect(record.body).toEqual({ headers: { "X-Api-Key": WORKFLOW_SECRET_MASK }, ok: true });
    // Later steps read the response in memory as the endpoint sent it.
    expect(variables.body).toEqual({ headers: { "X-Api-Key": "sk-live-123456" }, ok: true });
  });

  test("masks the secret in a text body too", () => {
    const response: WorkflowHttpResponse = {
      status: 200,
      contentType: "text/plain",
      bodyText: "you sent token=abcd-secret-9 ok",
      truncated: false,
    };

    const { record } = summarizeWorkflowHttpResponse(response, ["abcd-secret-9"]);

    expect(record.body).toBe(`you sent token=${WORKFLOW_SECRET_MASK} ok`);
  });

  test("keeps the body unchanged without secrets", () => {
    const { record } = summarizeWorkflowHttpResponse(echo({ a: 1 }));
    expect(record.body).toEqual({ a: 1 });
  });
});

describe("collectSentSecretValues", () => {
  test("returns the values sent for headers the record masks, ignoring case", () => {
    const values = collectSentSecretValues(
      { method: "POST", url: "https://x.test", headers: { "x-api-key": "sk-live-123456", "X-Source": "fb" } },
      {
        method: "POST",
        url: "https://x.test",
        headers: [
          { name: "X-Api-Key", value: WORKFLOW_SECRET_MASK },
          { name: "X-Source", value: "fb" },
        ],
      }
    );
    expect(values).toEqual(["sk-live-123456"]);
  });

  test("skips values too short to mask without mangling the body", () => {
    const values = collectSentSecretValues(
      { method: "GET", url: "https://x.test", headers: { "X-Pin": "1" } },
      { method: "GET", url: "https://x.test", headers: [{ name: "X-Pin", value: WORKFLOW_SECRET_MASK }] }
    );
    expect(values).toEqual([]);
  });
});
