import type { TSetupGuideUrls } from "./setup-guide";

/**
 * `/llms.txt`: a tiny index for agents that arrive without being told where to start. It points at the
 * Setup guide and the MCP server and carries nothing instance-private.
 */
export const getLlmsTxt = ({ baseUrl, mcpUrl }: Readonly<TSetupGuideUrls>): string => `# Formbricks

> Formbricks is an open source experience management platform. Agents build surveys, collect feedback and analyze responses through its MCP server; there is no survey editor to click through.

- [Set up a Formbricks account](${baseUrl}/agents/setup.md): the guide an agent follows to set up a person's account, create a workspace, draft a first survey and publish it with the person's approval.
- MCP server: ${mcpUrl} (Streamable HTTP, OAuth sign-in). Call \`get_account_context\` first.
- [Documentation](https://formbricks.com/docs): product and API documentation.
`;
