import { describe, expect, test } from "vitest";
import {
  MCP_APP_MIME_TYPE,
  MCP_APP_URI_SCHEME,
  MCP_UI_EXTENSION_ID,
  getMcpAppResourceUri,
} from "./constants";
import { buildMcpAppOnlyToolMeta, buildMcpAppToolMeta } from "./tool-meta";

// The expected strings are quoted from the MCP Apps specification (2026-01-26), not derived from the
// code under test, so a typo in either place is caught.
describe("MCP Apps constants", () => {
  test("match the spec's normative identifiers", () => {
    expect(MCP_APP_MIME_TYPE).toBe("text/html;profile=mcp-app");
    expect(MCP_UI_EXTENSION_ID).toBe("io.modelcontextprotocol/ui");
    expect(MCP_APP_URI_SCHEME).toBe("ui://");
  });

  test("view resources use the ui:// scheme", () => {
    expect(getMcpAppResourceUri("survey-preview")).toBe("ui://formbricks/survey-preview.html");
    expect(getMcpAppResourceUri("workflow").startsWith(MCP_APP_URI_SCHEME)).toBe(true);
  });
});

describe("tool metadata", () => {
  test("a render tool links its view through _meta.ui.resourceUri and the compatibility aliases", () => {
    expect(buildMcpAppToolMeta("survey-preview")).toEqual({
      ui: { resourceUri: "ui://formbricks/survey-preview.html" },
      "ui/resourceUri": "ui://formbricks/survey-preview.html",
      "openai/outputTemplate": "ui://formbricks/survey-preview.html",
    });
  });

  test("visibility is only written when asked for, so the spec default applies otherwise", () => {
    expect(buildMcpAppToolMeta("responses").ui).not.toHaveProperty("visibility");
    expect(buildMcpAppToolMeta("responses", { visibility: ["model"] }).ui).toEqual({
      resourceUri: "ui://formbricks/responses.html",
      visibility: ["model"],
    });
  });

  test("an app-only tool is hidden from the model and links no view", () => {
    expect(buildMcpAppOnlyToolMeta()).toEqual({ ui: { visibility: ["app"] } });
  });
});
