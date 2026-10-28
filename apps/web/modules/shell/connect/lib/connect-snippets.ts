/** Name the server is registered under in the agent. Matches the MCP docs. */
export const MCP_SERVER_NAME = "formbricks";

/** The environment variable the API key snippets read the key from, so it never lands in shell history. */
export const API_KEY_ENV_VAR = "FORMBRICKS_API_KEY";

export interface TConnectSnippets {
  claudeCode: string;
  codexAdd: string;
  /** Empty for the API key flow: the key replaces the sign-in step. */
  codexLogin: string;
  cursor: string;
}

/**
 * Commands for an agent that signs in with OAuth. The agent discovers the sign-in from the server URL,
 * so there is nothing to paste but the URL. Codex also takes `--oauth-resource` so its token is bound to
 * this server (docs/development/technical-handbook/mcp-server.mdx).
 */
export const getOAuthSnippets = (serverUrl: string): TConnectSnippets => ({
  claudeCode: `claude mcp add --transport http ${MCP_SERVER_NAME} ${serverUrl}`,
  codexAdd: `codex mcp add ${MCP_SERVER_NAME} --url ${serverUrl} --oauth-resource ${serverUrl}`,
  codexLogin: `codex mcp login ${MCP_SERVER_NAME}`,
  cursor: JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { url: serverUrl } } }, null, 2),
});

/**
 * Commands for a client that authenticates with an API key. Each reads the key from
 * {@link API_KEY_ENV_VAR} and sends it as `Authorization: Bearer`; the server also accepts `x-api-key`.
 */
export const getApiKeySnippets = (serverUrl: string): TConnectSnippets => ({
  claudeCode: `claude mcp add --transport http ${MCP_SERVER_NAME} ${serverUrl} --header "Authorization: Bearer $${API_KEY_ENV_VAR}"`,
  codexAdd: `codex mcp add ${MCP_SERVER_NAME} --url ${serverUrl} --bearer-token-env-var ${API_KEY_ENV_VAR}`,
  codexLogin: "",
  cursor: JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          url: serverUrl,
          headers: { Authorization: `Bearer \${env:${API_KEY_ENV_VAR}}` },
        },
      },
    },
    null,
    2
  ),
});
