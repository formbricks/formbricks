import { describe, expect, test } from "vitest";
import { redactIntegrationCredentials } from "./redact-credentials";

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
