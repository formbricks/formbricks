import { describe, expect, test } from "vitest";
import {
  MCP_GRANT_NOT_SAVED_CODE,
  MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
  getConsentErrorMessage,
} from "./mcp-grant-consent-errors";

const t = (key: string) => `t:${key}`;

describe("getConsentErrorMessage", () => {
  test("names a selection the user can no longer pick", () => {
    expect(getConsentErrorMessage({ status: 422, code: MCP_GRANT_SELECTION_UNAVAILABLE_CODE }, t)).toBe(
      "t:auth.oauth.consent_grant_selection_unavailable"
    );
  });

  test("names a grant that couldn't be saved", () => {
    expect(getConsentErrorMessage({ status: 500, code: MCP_GRANT_NOT_SAVED_CODE }, t)).toBe(
      "t:auth.oauth.consent_grant_not_saved"
    );
  });

  test("falls back to the generic failure for anything else", () => {
    expect(getConsentErrorMessage({ status: 400, code: "invalid_request" }, t)).toBe(
      "t:auth.oauth.consent_failed"
    );
    expect(getConsentErrorMessage(null, t)).toBe("t:auth.oauth.consent_failed");
    expect(getConsentErrorMessage("boom", t)).toBe("t:auth.oauth.consent_failed");
  });
});
