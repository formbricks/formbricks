import "server-only";
import { createMcpHandler } from "mcp-handler";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./constants";
import { registerSurveyTools } from "./tools/surveys";
import { registerWorkflowTools } from "./tools/workflows";
import { registerWorkspaceTools } from "./tools/workspaces";

export const mcpHandler = createMcpHandler(
  (server) => {
    registerSurveyTools(server);
    registerWorkflowTools(server);
    registerWorkspaceTools(server);
  },
  {
    serverInfo: {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
    sessionIdGenerator: undefined,
    verboseLogs: false,
  }
);
