import { describe, expect, test } from "vitest";
import {
  MCP_GRANT_BEYOND_SCOPES_CODE,
  MCP_GRANT_CHANGED_CODE,
  MCP_GRANT_INVALID_CODE,
  MCP_GRANT_NOT_SAVED_CODE,
  MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
  getGrantErrorMessage,
} from "./mcp-grant-consent-errors";

const t = (key: string) => `t:${key}`;

describe("getGrantErrorMessage", () => {
  test.each([
    [MCP_GRANT_SELECTION_UNAVAILABLE_CODE, "auth.oauth.consent_grant_selection_unavailable"],
    [MCP_GRANT_NOT_SAVED_CODE, "auth.oauth.consent_grant_not_saved"],
    [MCP_GRANT_CHANGED_CODE, "auth.oauth.grant_changed_elsewhere"],
    [MCP_GRANT_BEYOND_SCOPES_CODE, "auth.oauth.grant_beyond_scopes"],
    [MCP_GRANT_INVALID_CODE, "auth.oauth.grant_invalid"],
  ])("translates a %s refusal from its code, never the server's detail", (code, key) => {
    expect(getGrantErrorMessage({ status: 422, code, detail: "English" }, t)).toBe(`t:${key}`);
  });

  test("hands the caller its own fallback for anything else", () => {
    expect(getGrantErrorMessage({ status: 400, code: "invalid_request" }, t)).toBeNull();
    expect(getGrantErrorMessage({ status: 500, title: "Internal Server Error" }, t)).toBeNull();
    expect(getGrantErrorMessage(null, t)).toBeNull();
    expect(getGrantErrorMessage("boom", t)).toBeNull();
    expect(getGrantErrorMessage({ code: "toString" }, t)).toBeNull();
  });
});
