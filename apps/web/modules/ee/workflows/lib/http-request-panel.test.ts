import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import {
  buildTestRequestInput,
  cancelReplacingSecret,
  describeHttpRequestTarget,
  findDuplicateHeaderIndexes,
  formatResponseBody,
  getHeaderRowKind,
  getSavedSecretHeaderNames,
  getSecretReplaceMode,
  isPlainHttpUrl,
  methodSendsBody,
  renameHeader,
  settleSentSecretValues,
  shouldWarnSecretGoesLive,
  startReplacingSecret,
  toStoredBody,
  toggleHeaderLock,
  urlHasVariables,
  withSecretIdsForCheck,
} from "./http-request-panel";

describe("describeHttpRequestTarget", () => {
  test("says the method, host and path", () => {
    expect(describeHttpRequestTarget({ method: "POST", url: "https://dl.acme.example/interactions" })).toBe(
      "POST dl.acme.example/interactions"
    );
    expect(describeHttpRequestTarget({ method: "GET", url: "https://api.example.com/" })).toBe(
      "GET api.example.com"
    );
  });

  test("is null until the URL is a URL", () => {
    expect(describeHttpRequestTarget({ method: "POST", url: "" })).toBeNull();
    expect(describeHttpRequestTarget({ method: "POST", url: "dl.acme.example" })).toBeNull();
  });
});

describe("URL checks", () => {
  test("warns about plain HTTP, except on localhost", () => {
    expect(isPlainHttpUrl("http://api.example.com/hook")).toBe(true);
    expect(isPlainHttpUrl("https://api.example.com/hook")).toBe(false);
    expect(isPlainHttpUrl("http://localhost:3000/hook")).toBe(false);
    expect(isPlainHttpUrl("not a url")).toBe(false);
  });

  test("spots a Variable in the URL, which saving refuses", () => {
    expect(urlHasVariables("https://api.example.com/#recall:payload.id/fallback:#")).toBe(true);
    expect(urlHasVariables("https://api.example.com/customers")).toBe(false);
  });
});

describe("formatResponseBody", () => {
  test("shows text as it came and JSON pretty-printed", () => {
    expect(formatResponseBody("plain text")).toBe("plain text");
    expect(formatResponseBody({ id: 1 })).toBe('{\n  "id": 1\n}');
  });
});

describe("body", () => {
  test("only POST, PUT and PATCH send one", () => {
    expect(["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) => methodSendsBody(m as never))).toEqual([
      "POST",
      "PUT",
      "PATCH",
    ]);
  });

  test("blank text is stored as no body", () => {
    expect(toStoredBody("  \n")).toBeNull();
    expect(toStoredBody('{"a":1}')).toBe('{"a":1}');
  });
});

describe("header rows", () => {
  test("tell plain values, stored secrets, typed secrets and secrets still missing a value apart", () => {
    expect(getHeaderRowKind({ name: "X-Source", value: "formbricks" })).toBe("plain");
    expect(getHeaderRowKind({ name: "Authorization", secret: true, isSet: true })).toBe("secret_set");
    expect(getHeaderRowKind({ name: "Authorization", secret: true, value: "Bearer x" })).toBe("secret_value");
    expect(getHeaderRowKind({ name: "Authorization", secret: true, isSet: false })).toBe("secret_missing");
  });

  test("lock by default for Authorization and credential-looking names, until the lock is set by hand", () => {
    expect(renameHeader({ name: "Auth", value: "x" }, "Authorization", false)).toEqual({
      name: "Authorization",
      secret: true,
      value: "x",
    });
    expect(renameHeader({ name: "X-Api", value: "x" }, "X-Api-Key", false)).toMatchObject({ secret: true });
    expect(renameHeader({ name: "Authorization", secret: true, value: "x" }, "X-Source", false)).toEqual({
      name: "X-Source",
      value: "x",
    });
    expect(renameHeader({ name: "Auth", value: "x" }, "Authorization", true)).toEqual({
      name: "Authorization",
      value: "x",
    });
  });

  test("keep a stored secret locked whatever it is renamed to", () => {
    expect(renameHeader({ name: "Authorization", secret: true, isSet: true }, "X-Source", false)).toEqual({
      name: "X-Source",
      secret: true,
      isSet: true,
    });
  });

  test("locking keeps the typed value as the secret; unlocking a stored one starts empty", () => {
    expect(toggleHeaderLock({ name: "X-Token", value: "abc" })).toEqual({
      name: "X-Token",
      secret: true,
      value: "abc",
    });
    expect(toggleHeaderLock({ name: "X-Token", secret: true, isSet: true })).toEqual({
      name: "X-Token",
      value: "",
    });
  });

  test("Replace types a new value; cancelling keeps the stored one", () => {
    const stored = { name: "Authorization", secret: true, isSet: true };
    expect(startReplacingSecret(stored)).toEqual({ name: "Authorization", secret: true, value: "" });
    expect(cancelReplacingSecret(startReplacingSecret(stored))).toEqual(stored);
  });

  test("flag every row of a name used twice, whatever the case", () => {
    expect(
      [
        ...findDuplicateHeaderIndexes([
          { name: "Authorization", secret: true, isSet: true },
          { name: "X-Source", value: "a" },
          { name: "authorization", value: "b" },
          { name: "", value: "" },
          { name: "", value: "" },
        ]),
      ].sort()
    ).toEqual([0, 2]);
  });
});

describe("getSavedSecretHeaderNames", () => {
  test("names the secrets the saved step holds a value for", () => {
    const saved = {
      nodes: [
        {
          id: "call",
          type: "action",
          actionType: "http_request",
          config: {
            headers: [
              { name: "Authorization", secret: true, isSet: true },
              { name: "X-Token", secret: true, isSet: false },
              { name: "X-Source", value: "a" },
            ],
          },
        },
      ],
    } as unknown as TWorkflowDefinition;

    expect([...getSavedSecretHeaderNames(saved, "call")]).toEqual(["authorization"]);
    expect(getSavedSecretHeaderNames(saved, "other").size).toBe(0);
    expect(getSavedSecretHeaderNames(null, "call").size).toBe(0);
  });
});

describe("getSecretReplaceMode", () => {
  test("writes the new value with the draft while the workflow can be edited", () => {
    expect(getSecretReplaceMode({ status: "draft", isEditable: true, isReadOnly: false })).toBe("inline");
    expect(getSecretReplaceMode({ status: "disabled", isEditable: true, isReadOnly: false })).toBe("inline");
  });

  test("saves it on its own on an enabled, read-only workflow", () => {
    expect(getSecretReplaceMode({ status: "enabled", isEditable: false, isReadOnly: false })).toBe("live");
  });

  test("offers no Replace to a read-only member or on an archived workflow", () => {
    expect(getSecretReplaceMode({ status: "enabled", isEditable: false, isReadOnly: true })).toBeNull();
    expect(getSecretReplaceMode({ status: "archived", isEditable: false, isReadOnly: false })).toBeNull();
  });
});

describe("shouldWarnSecretGoesLive", () => {
  test("warns once the workflow has been enabled", () => {
    expect(shouldWarnSecretGoesLive("disabled")).toBe(true);
    expect(shouldWarnSecretGoesLive("enabled")).toBe(true);
    expect(shouldWarnSecretGoesLive("draft")).toBe(false);
  });
});

describe("withSecretIdsForCheck", () => {
  const withHeaders = (headers: unknown[]) =>
    ({
      nodes: [{ id: "call", type: "action", actionType: "http_request", config: { headers } }],
    }) as unknown as TWorkflowDefinition;
  const headersOf = (definition: TWorkflowDefinition) =>
    (definition.nodes[0] as { config: { headers: Record<string, unknown>[] } }).config.headers;

  test("treats a stored or typed secret as stored, so the live check doesn't flag it", () => {
    const checked = withSecretIdsForCheck(
      withHeaders([
        { name: "Authorization", secret: true, isSet: true },
        { name: "X-Token", secret: true, value: "abc" },
      ])
    );
    expect(headersOf(checked).every((header) => typeof header.secretId === "string")).toBe(true);
  });

  test("leaves a secret without any value to be flagged", () => {
    const definition = withHeaders([{ name: "Authorization", secret: true, isSet: false }]);
    expect(headersOf(withSecretIdsForCheck(definition))[0]).not.toHaveProperty("secretId");
  });
});

describe("buildTestRequestInput", () => {
  const config = {
    method: "POST" as const,
    url: "https://api.example.com",
    queryParameters: [],
    headers: [],
    body: null,
    responseMode: "wait" as const,
    continueOnError: false,
  };

  test("sends the draft settings with the test payload kept in this browser", () => {
    expect(buildTestRequestInput(config, '{"customer":{"id":"C-1"}}')).toEqual({
      config,
      variables: { payload: { customer: { id: "C-1" } } },
    });
  });

  test("leaves the payload to the server's Sample payload when there is no usable test payload", () => {
    expect(buildTestRequestInput(config, null)).toEqual({ config });
    expect(buildTestRequestInput(config, '{"customer":')).toEqual({ config });
    expect(buildTestRequestInput(config, "[1]")).toEqual({ config });
  });
});

describe("settleSentSecretValues", () => {
  const withHeaders = (headers: unknown[]) =>
    ({
      nodes: [
        {
          id: "call",
          type: "action",
          actionType: "http_request",
          config: { method: "GET", url: "https://a.example", queryParameters: [], headers },
        },
      ],
    }) as unknown as TWorkflowDefinition;

  test("swaps a saved secret value for the stored shape, so the next save does not send it again", () => {
    const sent = withHeaders([
      { name: "Authorization", secret: true, value: "Bearer new" },
      { name: "X-Source", value: "formbricks" },
    ]);

    const settled = settleSentSecretValues(sent, sent);

    expect((settled.nodes[0] as { config: { headers: unknown[] } }).config.headers).toEqual([
      { name: "Authorization", secret: true, isSet: true },
      { name: "X-Source", value: "formbricks" },
    ]);
  });

  test("keeps a value typed after the save was sent", () => {
    const sent = withHeaders([{ name: "Authorization", secret: true, value: "Bearer n" }]);
    const draft = withHeaders([{ name: "Authorization", secret: true, value: "Bearer ne" }]);

    expect(settleSentSecretValues(draft, sent)).toBe(draft);
  });
});
