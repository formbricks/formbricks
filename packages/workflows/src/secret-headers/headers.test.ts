import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "../types/document";
import { findWorkflowSecretHeader, setWorkflowSecretHeaderId } from "./headers";

const definition = {
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
  nodes: [
    {
      id: "call",
      type: "action",
      actionType: "http_request",
      config: {
        method: "POST",
        url: "https://api.example.com",
        queryParameters: [],
        headers: [
          { name: "Authorization", secret: true, secretId: "sec_1" },
          { name: "X-Api-Key", secret: true },
          { name: "X-Team", value: "growth" },
        ],
        responseMode: "wait",
        continueOnError: false,
      },
    },
    { id: "check", type: "if_else", config: { condition: { id: "g", connector: "and", conditions: [] } } },
  ],
  edges: [],
} as unknown as TWorkflowDefinition;

describe("findWorkflowSecretHeader", () => {
  test("finds a secret header of an HTTP request step by name, ignoring case", () => {
    expect(findWorkflowSecretHeader(definition, "call", "authorization")).toEqual({
      name: "Authorization",
      secretId: "sec_1",
    });
    expect(findWorkflowSecretHeader(definition, "call", "X-API-KEY")).toEqual({
      name: "X-Api-Key",
      secretId: undefined,
    });
  });

  test("finds nothing for a plain header, another step or a missing definition", () => {
    expect(findWorkflowSecretHeader(definition, "call", "X-Team")).toBeNull();
    expect(findWorkflowSecretHeader(definition, "check", "Authorization")).toBeNull();
    expect(findWorkflowSecretHeader(definition, "nope", "Authorization")).toBeNull();
    expect(findWorkflowSecretHeader(null, "call", "Authorization")).toBeNull();
  });
});

describe("setWorkflowSecretHeaderId", () => {
  test("points that one secret header at a stored value and leaves everything else as it was", () => {
    const updated = setWorkflowSecretHeaderId(definition, "call", "x-api-key", "sec_2");

    const call = updated.nodes[0] as unknown as { config: { headers: unknown[] } };
    expect(call.config.headers).toEqual([
      { name: "Authorization", secret: true, secretId: "sec_1" },
      { name: "X-Api-Key", secret: true, secretId: "sec_2" },
      { name: "X-Team", value: "growth" },
    ]);
    expect(updated.nodes[1]).toBe(definition.nodes[1]);
  });
});
