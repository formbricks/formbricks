import { describe, expect, test } from "vitest";
import { redactIntegrationCredentials, withStoredIntegrationKey } from "./redact-credentials";

describe("redactIntegrationCredentials", () => {
  // Regression: these objects are passed to "use client" wrappers, so anything left in them ends up in
  // the RSC payload in the page source.
  test("blanks the OAuth tokens on a Google Sheets integration", () => {
    const integration = {
      id: "int_1",
      type: "googleSheets",
      config: {
        email: "owner@example.com",
        data: [{ spreadsheetId: "sheet_1" }],
        key: {
          scope: "https://www.googleapis.com/auth/spreadsheets",
          token_type: "Bearer",
          expiry_date: 123,
          access_token: "ya29.super-secret",
          refresh_token: "1//long-lived-secret",
        },
      },
    };

    const redacted = redactIntegrationCredentials(integration);

    expect(redacted?.config.key.access_token).toBe("");
    expect(redacted?.config.key.refresh_token).toBe("");
    // Non-secret fields the UI needs are preserved.
    expect(redacted?.config.key.scope).toBe("https://www.googleapis.com/auth/spreadsheets");
    expect(redacted?.config.email).toBe("owner@example.com");
    expect(redacted?.config.data).toEqual([{ spreadsheetId: "sheet_1" }]);
  });

  test("preserves the display fields Notion and Slack read from the key", () => {
    const notion = redactIntegrationCredentials({
      config: { key: { access_token: "secret", bot_id: "bot_1", workspace_name: "Acme" }, data: [] },
    });
    expect(notion?.config.key).toEqual({ access_token: "", bot_id: "bot_1", workspace_name: "Acme" });

    const slack = redactIntegrationCredentials({
      config: { key: { access_token: "xoxb-secret", team: { id: "T1", name: "Acme" } }, data: [] },
    });
    expect(slack?.config.key).toEqual({ access_token: "", team: { id: "T1", name: "Acme" } });
  });

  // The point of matching on the field name is that a credential a provider adds later is redacted
  // without anyone having to remember to extend a list.
  test("blanks credential-shaped fields it has never seen before", () => {
    const redacted = redactIntegrationCredentials({
      config: {
        key: {
          id_token: "eyJ-secret",
          client_secret: "cs-secret",
          service_account_private_key: "-----BEGIN PRIVATE KEY-----",
          api_key: "ak-secret",
          token: "bare-secret",
        },
        data: [],
      },
    });

    expect(redacted?.config.key).toEqual({
      id_token: "",
      client_secret: "",
      service_account_private_key: "",
      api_key: "",
      token: "",
    });
  });

  // `token_type` names the scheme, and Slack/Google Sheets type it as a Zod literal — blanking it would
  // make the redacted object stop satisfying the integration type it is passed as.
  test.each([
    ["token_type", "Bearer"],
    ["workspace_id", "ws_1"],
    ["bot_user_id", "U1"],
    ["app_id", "A1"],
    ["expiry_date", "2026-01-01"],
  ])("leaves the non-secret field %s alone", (field, value) => {
    const redacted = redactIntegrationCredentials({
      config: { key: { [field]: value, access_token: "secret" }, data: [] },
    });

    expect(redacted?.config.key[field]).toBe(value);
    expect(redacted?.config.key.access_token).toBe("");
  });

  test("does not mutate the input", () => {
    const key = { access_token: "secret", refresh_token: "secret2" };
    const integration = { config: { key } };

    redactIntegrationCredentials(integration);

    expect(key.access_token).toBe("secret");
    expect(key.refresh_token).toBe("secret2");
  });

  test.each([
    ["undefined integration", undefined],
    ["no config", {}],
    ["null config", { config: null }],
    ["no key", { config: { data: [] } }],
  ])("passes through %s unchanged", (_label, input) => {
    expect(redactIntegrationCredentials(input as never)).toEqual(input);
  });
});

describe("withStoredIntegrationKey", () => {
  const stored = {
    config: { key: { access_token: "real-access", refresh_token: "real-refresh" }, data: [] },
  };

  // Regression for the round-trip that redaction created: the settings pages blank config.key on the
  // way out, and the mapping UI echoes the whole integration back on add / edit / delete. Honouring the
  // echoed key wrote empty strings over the stored tokens and disconnected the integration, while the
  // UI still showed it connected because the wrappers only test config.key for presence.
  test("keeps the stored credentials when the client echoes blanked ones", () => {
    const incoming = {
      type: "notion",
      config: { key: { access_token: "", refresh_token: "" }, data: [{ surveyId: "s1" }] },
    };

    const result = withStoredIntegrationKey(incoming as never, stored as never);

    expect(result.config.key).toEqual(stored.config.key);
    // the non-secret payload the client legitimately owns still wins
    expect(result.config.data).toEqual([{ surveyId: "s1" }]);
  });

  test("keeps the stored credentials even when the client sends a different key", () => {
    const incoming = { type: "notion", config: { key: { access_token: "attacker" }, data: [] } };

    expect(withStoredIntegrationKey(incoming as never, stored as never).config.key).toEqual(
      stored.config.key
    );
  });

  test.each([
    ["no stored integration", null],
    ["stored integration without a key", { config: { data: [] } }],
  ])("passes the input through when there is %s", (_label, storedValue) => {
    const incoming = { type: "notion", config: { key: { access_token: "fresh" }, data: [] } };

    expect(withStoredIntegrationKey(incoming as never, storedValue as never)).toEqual(incoming);
  });
});
