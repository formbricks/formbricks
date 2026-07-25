import "server-only";
import { createMcpHandler } from "mcp-handler";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./constants";
import { registerFeedbackRecordTools } from "./tools/feedback-records";
import { registerSurveyTools } from "./tools/surveys";
import { registerWorkspaceTools } from "./tools/workspaces";

export const mcpHandler = createMcpHandler(
  (server) => {
    registerSurveyTools(server);
    registerWorkspaceTools(server);
    registerFeedbackRecordTools(server);
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
