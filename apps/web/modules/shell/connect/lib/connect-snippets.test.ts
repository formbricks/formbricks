import { describe, expect, test } from "vitest";
import { getApiKeySnippets, getOAuthSnippets } from "./connect-snippets";

const serverUrl = "https://app.example.com/api/mcp";

describe("getOAuthSnippets", () => {
  test("registers the server by URL and binds the Codex token to it", () => {
    const snippets = getOAuthSnippets(serverUrl);

    expect(snippets.claudeCode).toBe(`claude mcp add --transport http formbricks ${serverUrl}`);
    expect(snippets.codexAdd).toBe(
      `codex mcp add formbricks --url ${serverUrl} --oauth-resource ${serverUrl}`
    );
    expect(snippets.codexLogin).toBe("codex mcp login formbricks");
  });

  test("the Cursor snippet is valid JSON pointing at the server", () => {
    expect(JSON.parse(getOAuthSnippets(serverUrl).cursor)).toEqual({
      mcpServers: { formbricks: { url: serverUrl } },
    });
  });
});

describe("getApiKeySnippets", () => {
  test("never embeds a key, only the environment variable that holds it", () => {
    const snippets = getApiKeySnippets(serverUrl);

    expect(snippets.claudeCode).toContain('--header "Authorization: Bearer $FORMBRICKS_API_KEY"');
    expect(snippets.codexAdd).toContain("--bearer-token-env-var FORMBRICKS_API_KEY");
    expect(JSON.parse(snippets.cursor).mcpServers.formbricks.headers.Authorization).toBe(
      "Bearer ${env:FORMBRICKS_API_KEY}"
    );
  });

  test("has no sign-in step", () => {
    expect(getApiKeySnippets(serverUrl).codexLogin).toBe("");
  });
});
