import type { McpServer } from "@modelcontextprotocol/server";
import { getSetupGuide } from "@/modules/agent-setup/setup-guide";
import { getSetupGuideUrl, getSetupGuideUrls } from "@/modules/agent-setup/urls";

export const MCP_SETUP_PROMPT_NAME = "setup";

/**
 * What the server tells a client when it connects. Short on purpose: the guide carries the detail, this only
 * says where to start.
 */
export const getMcpServerInstructions = (): string =>
  [
    "Formbricks: build surveys, collect feedback and analyze responses for the person you act for.",
    "Call get_account_context first to learn who they are and how far their setup has got.",
    `For first-time setup, follow the setup guide at ${getSetupGuideUrl()} or run the ${MCP_SETUP_PROMPT_NAME} prompt.`,
  ].join(" ");

/** The Setup guide as a slash command: the same text `GET /agents/setup.md` serves, as one user message. */
export function registerMcpPrompts(server: McpServer): void {
  server.registerPrompt(
    MCP_SETUP_PROMPT_NAME,
    {
      title: "Set up my Formbricks account",
      description:
        "Guide the person through setting up their Formbricks account: workspace, branding and a first survey.",
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: getSetupGuide(getSetupGuideUrls()) },
        },
      ],
    })
  );
}
