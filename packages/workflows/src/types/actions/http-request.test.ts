import { describe, expect, test } from "vitest";
import {
  type TWorkflowDefinitionBase,
  WORKFLOW_LIMITS,
  ZWorkflowDefinition,
  ZWorkflowExecutableDefinition,
  ZWorkflowSecretHeaderValue,
  isDefaultSecretHeaderName,
} from "..";

const surveyId = "cm9zr4mps000008l8btfy1vtz";

const httpConfig = (overrides: Record<string, unknown> = {}) => ({
  method: "POST",
  url: "https://api.example.com/customers",
  queryParameters: [{ name: "source", value: "formbricks" }],
  headers: [{ name: "X-Team", value: "growth" }],
  body: '{"answer": "#recall:response.q1/fallback:#"}',
  responseMode: "wait",
  continueOnError: false,
  ...overrides,
});

const http = (id: string, config: Record<string, unknown>) => ({
  id,
  type: "action" as const,
  actionType: "http_request" as const,
  config,
});

const emailAfter = (body: string) => ({
  id: "email",
  type: "action" as const,
  actionType: "send_email" as const,
  config: {
    from: "noreply@example.com",
    to: "jane@example.com",
    replyTo: [],
    subject: "Status",
    body,
    attachResponseData: false,
  },
});

/** trigger → call (→ email) */
const definition = (config: Record<string, unknown>, extra: unknown[] = []): TWorkflowDefinitionBase =>
  ({
    schemaVersion: 1,
    trigger: {
      id: "trigger",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId, endingCardIds: [] },
    },
    nodes: [http("call", config), ...extra],
    edges: [
      { id: "e1", source: "trigger", target: "call" },
      ...(extra.length > 0 ? [{ id: "e2", source: "call", target: "email" }] : []),
    ],
    entryNodeId: "trigger",
  }) as TWorkflowDefinitionBase;

const issues = (result: { success: boolean; error?: { issues: { message: string }[] } }): string[] =>
  result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);

describe("http_request definition (saving)", () => {
  test("a complete request saves and runs", () => {
    expect(ZWorkflowDefinition.safeParse(definition(httpConfig())).success).toBe(true);
    expect(ZWorkflowExecutableDefinition.safeParse(definition(httpConfig())).success).toBe(true);
  });

  test("a draft with no URL yet can be saved but not run", () => {
    const draft = definition(httpConfig({ url: "" }));
    expect(ZWorkflowDefinition.safeParse(draft).success).toBe(true);
    expect(issues(ZWorkflowExecutableDefinition.safeParse(draft)).join()).toMatch(/URL/);
  });

  test("saving refuses a Variable in the URL, so a payload never chooses the host (ADR 0042)", () => {
    for (const url of [
      "https://#recall:payload.host/fallback:x#/path",
      "https://api.example.com/customers/#recall:payload.id/fallback:#",
    ]) {
      expect(issues(ZWorkflowDefinition.safeParse(definition(httpConfig({ url })))).join()).toMatch(
        /Variables/
      );
    }
  });

  test("applies the header, URL and body template limits on save", () => {
    const tooManyHeaders = Array.from({ length: WORKFLOW_LIMITS.maxHttpHeaders + 1 }, (_, index) => ({
      name: `X-H${index.toString()}`,
      value: "v",
    }));
    const longUrl = `https://api.example.com/${"a".repeat(WORKFLOW_LIMITS.maxHttpUrlBytes)}`;
    const bigBody = JSON.stringify({ a: "é".repeat(WORKFLOW_LIMITS.maxHttpBodyTemplateBytes / 2) });

    expect(ZWorkflowDefinition.safeParse(definition(httpConfig({ headers: tooManyHeaders }))).success).toBe(
      false
    );
    expect(ZWorkflowDefinition.safeParse(definition(httpConfig({ url: longUrl }))).success).toBe(false);
    expect(ZWorkflowDefinition.safeParse(definition(httpConfig({ body: bigBody }))).success).toBe(false);
  });

  test("refuses header names that repeat or that the transport owns", () => {
    expect(
      ZWorkflowDefinition.safeParse(
        definition(
          httpConfig({
            headers: [
              { name: "X-Team", value: "a" },
              { name: "x-team", value: "b" },
            ],
          })
        )
      ).success
    ).toBe(false);
    for (const name of ["Host", "content-length", "Transfer-Encoding", "Bad Header"]) {
      expect(
        ZWorkflowDefinition.safeParse(definition(httpConfig({ headers: [{ name, value: "x" }] }))).success
      ).toBe(false);
    }
  });

  test("a plain header needs a value; a secret header may be unset in a draft", () => {
    expect(
      ZWorkflowDefinition.safeParse(definition(httpConfig({ headers: [{ name: "X-Team" }] }))).success
    ).toBe(false);
    expect(
      ZWorkflowDefinition.safeParse(
        definition(httpConfig({ headers: [{ name: "Authorization", secret: true }] }))
      ).success
    ).toBe(true);
  });

  test("refuses a secret value with a line break, typed as secret or secret by its name", () => {
    for (const header of [
      { name: "X-Team", secret: true, value: "Bearer a\r\nX-Evil: 1" },
      { name: "Authorization", value: "Bearer a\nb" },
    ]) {
      expect(ZWorkflowDefinition.safeParse(definition(httpConfig({ headers: [header] }))).success).toBe(
        false
      );
    }
    expect(
      ZWorkflowDefinition.safeParse(
        definition(httpConfig({ headers: [{ name: "Authorization", secret: true, value: "Bearer a" }] }))
      ).success
    ).toBe(true);
  });
});

describe("ZWorkflowSecretHeaderValue", () => {
  test("takes a non-empty value of up to 8 KB without line breaks", () => {
    expect(ZWorkflowSecretHeaderValue.safeParse("Bearer sk_live_1").success).toBe(true);
    expect(ZWorkflowSecretHeaderValue.safeParse("a".repeat(8 * 1024)).success).toBe(true);
    for (const value of ["", "a".repeat(8 * 1024 + 1), "a\rb", "a\nb", "a\u2028b"]) {
      expect(ZWorkflowSecretHeaderValue.safeParse(value).success).toBe(false);
    }
  });
});

describe("http_request definition (running)", () => {
  test("a secret header without a stored value blocks Enable (a duplicate must re-enter it)", () => {
    const unset = definition(httpConfig({ headers: [{ name: "Authorization", secret: true }] }));
    expect(issues(ZWorkflowExecutableDefinition.safeParse(unset)).join()).toMatch(/Authorization/);

    const stored = definition(
      httpConfig({ headers: [{ name: "Authorization", secret: true, secretId: "cm9zr4mps000008l8secret1" }] })
    );
    expect(ZWorkflowExecutableDefinition.safeParse(stored).success).toBe(true);
  });

  test("the URL must be an absolute http(s) address", () => {
    for (const url of ["not a url", "ftp://files.example.com/x", "/relative"]) {
      expect(ZWorkflowExecutableDefinition.safeParse(definition(httpConfig({ url }))).success).toBe(false);
    }
  });

  test("a body is only sent by POST, PUT and PATCH, and must be a JSON template", () => {
    expect(
      issues(ZWorkflowExecutableDefinition.safeParse(definition(httpConfig({ method: "GET" })))).join()
    ).toMatch(/body/);
    expect(
      ZWorkflowExecutableDefinition.safeParse(definition(httpConfig({ method: "GET", body: undefined })))
        .success
    ).toBe(true);
    expect(
      issues(ZWorkflowExecutableDefinition.safeParse(definition(httpConfig({ body: "{not json" })))).join()
    ).toMatch(/JSON/);
  });

  test("Variables in query values, header values and the body must be available at this step", () => {
    const payloadInQuery = definition(
      httpConfig({ queryParameters: [{ name: "id", value: "#recall:payload.id/fallback:#" }] })
    );
    expect(issues(ZWorkflowExecutableDefinition.safeParse(payloadInQuery)).join()).toMatch(/payload/);

    const laterStepInHeader = definition(
      httpConfig({ headers: [{ name: "X-Id", value: "#recall:steps.email.status/fallback:#" }] }),
      [emailAfter("ok")]
    );
    expect(issues(ZWorkflowExecutableDefinition.safeParse(laterStepInHeader)).join()).toMatch(
      /never runs before/
    );
  });

  test("a later step can read this step's status and body", () => {
    const reader = definition(httpConfig(), [
      emailAfter("Status #recall:steps.call.status/fallback:?# id #recall:steps.call.body.id/fallback:?#"),
    ]);
    expect(ZWorkflowExecutableDefinition.safeParse(reader).success).toBe(true);
  });
});

describe("isDefaultSecretHeaderName", () => {
  test("Authorization and names with token, key, secret or cookie are secret by default", () => {
    for (const name of ["Authorization", "X-Api-Key", "x-auth-token", "Client-Secret", "Cookie"]) {
      expect(isDefaultSecretHeaderName(name)).toBe(true);
    }
    for (const name of ["Accept", "X-Team", "Content-Type"]) {
      expect(isDefaultSecretHeaderName(name)).toBe(false);
    }
  });
});
