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
  test("masks a secret header value the endpoint echoes back, in what is kept and in what later steps read", () => {
    const response = echo({ headers: { "X-Api-Key": "sk-live-123456" }, ok: true });

    const { record, variables } = summarizeWorkflowHttpResponse(response, ["sk-live-123456"]);

    expect(JSON.stringify(record)).not.toContain("sk-live-123456");
    expect(record.body).toEqual({ headers: { "X-Api-Key": WORKFLOW_SECRET_MASK }, ok: true });
    // A later step could otherwise send the secret to another host, past its host binding.
    expect(variables.body).toEqual({ headers: { "X-Api-Key": WORKFLOW_SECRET_MASK }, ok: true });
  });

  test("masks the secret in a text body too", () => {
    const response: WorkflowHttpResponse = {
      status: 200,
      contentType: "text/plain",
      bodyText: "you sent token=abcd-secret-9 ok",
      truncated: false,
    };

    const { record, variables } = summarizeWorkflowHttpResponse(response, ["abcd-secret-9"]);

    expect(record.body).toBe(`you sent token=${WORKFLOW_SECRET_MASK} ok`);
    expect(variables.body).toBe(`you sent token=${WORKFLOW_SECRET_MASK} ok`);
  });

  test("masks a secret the JSON spells with escapes, which the raw text doesn't contain byte for byte", () => {
    // PHP's json_encode escapes `/` by default; any JSON may escape a character as \uXXXX.
    const response: WorkflowHttpResponse = {
      status: 200,
      contentType: "application/json",
      bodyText: String.raw`{"echo":"sk_test\/abc","again":"\u0073k_test/abc","sk_test\/abc":1}`,
      truncated: false,
    };

    const { record } = summarizeWorkflowHttpResponse(response, ["sk_test/abc"]);

    expect(record.body).toEqual({
      echo: WORKFLOW_SECRET_MASK,
      again: WORKFLOW_SECRET_MASK,
      [WORKFLOW_SECRET_MASK]: 1,
    });
  });

  test("masks a JSON-escaped secret in a body kept as text because it is too large to keep parsed", () => {
    const response: WorkflowHttpResponse = {
      status: 200,
      contentType: "application/json",
      bodyText: String.raw`{"echo":"sk_test\/abc","pad":"` + "x".repeat(70 * 1024) + '"}',
      truncated: false,
    };

    const { record } = summarizeWorkflowHttpResponse(response, ["sk_test/abc"]);

    expect(typeof record.body).toBe("string");
    expect(record.body).not.toContain("sk_test");
    expect(record.body).toContain(WORKFLOW_SECRET_MASK);
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

  const sentWith = (value: string) =>
    collectSentSecretValues(
      { method: "GET", url: "https://x.test", headers: { Authorization: value } },
      {
        method: "GET",
        url: "https://x.test",
        headers: [{ name: "Authorization", value: WORKFLOW_SECRET_MASK }],
      }
    );

  test("adds the token after a known scheme, so an echo of the token alone is masked too", () => {
    expect(sentWith("Bearer sk_live_123456")).toEqual(["Bearer sk_live_123456", "sk_live_123456"]);
    expect(sentWith("token ghp_abcdef")).toEqual(["token ghp_abcdef", "ghp_abcdef"]);

    const { variables } = summarizeWorkflowHttpResponse(
      echo({ authenticated: true, token: "sk_live_123456" }),
      sentWith("Bearer sk_live_123456")
    );
    expect(variables.body).toEqual({ authenticated: true, token: WORKFLOW_SECRET_MASK });
  });

  test("adds a Basic credential's decoded user:password and the password", () => {
    const encoded = Buffer.from("jane:s3cret-pass").toString("base64");
    expect(sentWith(`Basic ${encoded}`)).toEqual([
      `Basic ${encoded}`,
      encoded,
      "jane:s3cret-pass",
      "s3cret-pass",
    ]);
  });

  test("leaves a two-word value alone unless its first word is an auth scheme", () => {
    expect(sentWith("hello world")).toEqual(["hello world"]);
  });

  test("skips values too short to mask without mangling the body", () => {
    const values = collectSentSecretValues(
      { method: "GET", url: "https://x.test", headers: { "X-Pin": "1" } },
      { method: "GET", url: "https://x.test", headers: [{ name: "X-Pin", value: WORKFLOW_SECRET_MASK }] }
    );
    expect(values).toEqual([]);
  });
});
