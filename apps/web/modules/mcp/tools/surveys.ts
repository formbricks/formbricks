import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "@formbricks/logger";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { deleteV3Survey, listV3Surveys } from "@/app/api/v3/surveys/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpDeleteSurveyInput,
  type TMcpListSurveysInput,
  ZMcpDeleteSurveyInput,
  ZMcpListSurveysInput,
} from "./schemas";

export function buildListSurveysSearchParams(input: TMcpListSurveysInput): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", input.workspaceId);
  searchParams.set("limit", String(input.limit));

  if (input.cursor) {
    searchParams.set("cursor", input.cursor);
  }

  if (input.includeTotalCount === false) {
    searchParams.set("includeTotalCount", "false");
  }

  if (input.sortBy) {
    searchParams.set("sortBy", input.sortBy);
  }

  if (input.filter?.name?.contains) {
    searchParams.set("filter[name][contains]", input.filter.name.contains);
  }

  input.filter?.status?.in?.forEach((status) => {
    searchParams.append("filter[status][in]", status);
  });

  input.filter?.type?.in?.forEach((type) => {
    searchParams.append("filter[type][in]", type);
  });

  return searchParams;
}

export function registerSurveyTools(server: McpServer): void {
  server.registerTool(
    "list_surveys",
    {
      title: "List surveys",
      description: "List surveys in a Formbricks workspace using the v3 Surveys API contract.",
      inputSchema: ZMcpListSurveysInput.shape,
    },
    async (input: TMcpListSurveysInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const response = await listV3Surveys({
        searchParams: buildListSurveysSearchParams(input),
        authentication: getMcpAuthentication(extra.authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  server.registerTool(
    "delete_survey",
    {
      title: "Delete survey",
      description: "Delete a Formbricks survey using the v3 Surveys API contract.",
      inputSchema: ZMcpDeleteSurveyInput.shape,
      annotations: {
        destructiveHint: true,
      },
    },
    async (input: TMcpDeleteSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const authentication = getMcpAuthentication(extra.authInfo);
      const log = logger.withContext({ requestId, surveyId: input.surveyId });
      const auditLog = buildV3AuditLog(authentication, "deleted", "survey", MCP_API_ROUTE);

      try {
        const response = await deleteV3Survey({
          surveyId: input.surveyId,
          authentication,
          requestId,
          instance: MCP_API_ROUTE,
          auditLog,
        });

        if (auditLog) {
          if (response.ok) {
            auditLog.status = "success";
          } else {
            auditLog.eventId = requestId;
          }
        }

        await queueV3AuditLog(auditLog, requestId, log);
        return await responseToMcpToolResult(response, requestId);
      } catch (error) {
        if (auditLog) {
          auditLog.eventId = requestId;
          await queueV3AuditLog(auditLog, requestId, log);
        }

        throw error;
      }
    }
  );
}
