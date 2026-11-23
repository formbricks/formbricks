import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "../types/document";
import {
  findWorkflowSecretHostMismatches,
  getWorkflowUrlOrigin,
  resolveBoundWorkflowSecret,
} from "./binding";

describe("getWorkflowUrlOrigin", () => {
  test("is the scheme, host and port of an http(s) URL", () => {
    expect(getWorkflowUrlOrigin("https://api.example.com/v1/customers?id=1")).toBe("https://api.example.com");
    expect(getWorkflowUrlOrigin("http://api.example.com:8080/hook")).toBe("http://api.example.com:8080");
    expect(getWorkflowUrlOrigin("https://API.example.com:443/x")).toBe("https://api.example.com");
  });

  test("is null for anything that is not an absolute http(s) URL", () => {
    expect(getWorkflowUrlOrigin("")).toBeNull();
    expect(getWorkflowUrlOrigin("api.example.com/v1")).toBeNull();
    expect(getWorkflowUrlOrigin("ftp://files.example.com/a")).toBeNull();
  });
});

describe("resolveBoundWorkflowSecret", () => {
  const bound = { value: "sk_live_1", boundOrigin: "https://api.example.com" };

  test("gives the value to a request on the origin it was set for", () => {
    expect(
      resolveBoundWorkflowSecret({
        headerName: "Authorization",
        secret: bound,
        requestUrl: "https://api.example.com/v2/orders?page=2",
        savedUrl: "https://api.example.com/v2/orders",
      })
    ).toEqual({ value: "sk_live_1" });
  });

  test("refuses a request to another host, naming the header and the host it was set for", () => {
    expect(
      resolveBoundWorkflowSecret({
        headerName: "Authorization",
        secret: bound,
        requestUrl: "https://collector.attacker.example/steal",
        savedUrl: "https://collector.attacker.example/steal",
      })
    ).toEqual({
      error: "Secret header Authorization is set for api.example.com; enter it again for the new URL",
    });
  });

  test("treats another scheme or port as another origin", () => {
    for (const requestUrl of ["http://api.example.com/v2", "https://api.example.com:8443/v2"]) {
      expect(
        resolveBoundWorkflowSecret({
          headerName: "X-Api-Key",
          secret: bound,
          requestUrl,
          savedUrl: requestUrl,
        })
      ).toHaveProperty("error");
    }
  });

  test("holds a value set before host binding to the step's saved URL", () => {
    const legacy = { value: "sk_old", boundOrigin: null };
    expect(
      resolveBoundWorkflowSecret({
        headerName: "Authorization",
        secret: legacy,
        requestUrl: "https://api.example.com/other-path",
        savedUrl: "https://api.example.com/v1",
      })
    ).toEqual({ value: "sk_old" });
    expect(
      resolveBoundWorkflowSecret({
        headerName: "Authorization",
        secret: legacy,
        requestUrl: "https://elsewhere.example/v1",
        savedUrl: "https://api.example.com/v1",
      })
    ).toEqual({
      error: "Secret header Authorization is set for api.example.com; enter it again for the new URL",
    });
  });

  test("is undefined when there is no stored value", () => {
    expect(
      resolveBoundWorkflowSecret({
        headerName: "Authorization",
        secret: undefined,
        requestUrl: "https://api.example.com",
        savedUrl: "https://api.example.com",
      })
    ).toBeUndefined();
  });
});

describe("findWorkflowSecretHostMismatches", () => {
  const definition = {
    nodes: [
      {
        id: "call",
        type: "action",
        actionType: "http_request",
        config: {
          method: "POST",
          url: "https://new-api.example.com/v1",
          queryParameters: [],
          headers: [
            { name: "X-Team", value: "growth" },
            { name: "Authorization", secret: true, secretId: "sec_moved" },
            { name: "X-Api-Key", secret: true, secretId: "sec_rebound" },
            { name: "X-Legacy-Token", secret: true, secretId: "sec_legacy" },
            { name: "X-Missing-Key", secret: true },
          ],
          responseMode: "wait",
          continueOnError: false,
        },
      },
    ],
  } as unknown as Pick<TWorkflowDefinition, "nodes">;

  test("lists each stored secret whose value was set for another origin than its step's URL", () => {
    const boundOrigins = new Map<string, string | null>([
      ["sec_moved", "https://api.example.com"],
      ["sec_rebound", "https://new-api.example.com"],
      ["sec_legacy", null],
    ]);
    expect(findWorkflowSecretHostMismatches(definition, boundOrigins)).toEqual([
      {
        stepId: "call",
        headerName: "Authorization",
        path: ["nodes", 0, "config", "headers", 1],
        message: "Secret header Authorization is set for api.example.com; enter it again for the new URL",
      },
    ]);
  });
});
