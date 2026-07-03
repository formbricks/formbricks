import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "@formbricks/logger";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  createV3SurveyResponseFromRawInput,
  deleteV3Survey,
  getV3Survey,
  listV3Surveys,
  patchV3SurveyResponse,
  validateV3SurveyFromRawInput,
} from "@/app/api/v3/surveys/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import {
  createMcpInsufficientScopeResponse,
  getMcpAuthentication,
  getMcpRequestId,
  hasMcpScopes,
} from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpCreateSurveyInput,
  type TMcpDeleteSurveyInput,
  type TMcpGetSurveyInput,
  type TMcpListSurveysInput,
  type TMcpPatchSurveyInput,
  type TMcpValidateSurveyInput,
  ZMcpCreateSurveyInput,
  ZMcpDeleteSurveyInput,
  ZMcpGetSurveyInput,
  ZMcpListSurveysInput,
  ZMcpPatchSurveyInput,
  ZMcpValidateSurveyInput,
} from "./schemas";

export function buildListSurveysSearchParams(input: TMcpListSurveysInput): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", input.workspaceId);
  searchParams.set("limit", String(input.limit ?? 20));

  if (input.cursor) {
    searchParams.set("cursor", input.cursor);
  }

  if ((input.includeTotalCount ?? true) === false) {
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

async function guardMcpScopes(
  authInfo: AuthInfo | undefined,
  requiredScopes: string[],
  requestId: string
): Promise<CallToolResult | null> {
  if (hasMcpScopes(authInfo, requiredScopes)) {
    return null;
  }

  return await responseToMcpToolResult(
    createMcpInsufficientScopeResponse(requestId, requiredScopes),
    requestId
  );
}

export function registerSurveyTools(server: McpServer): void {
  server.registerTool(
    "list_surveys",
    {
      title: "List surveys",
      description: "List surveys in a Formbricks workspace using the v3 Surveys API contract.",
      inputSchema: ZMcpListSurveysInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input: TMcpListSurveysInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const scopeError = await guardMcpScopes(extra.authInfo, ["surveys:read"], requestId);
      if (scopeError) {
        return scopeError;
      }

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
    "get_survey",
    {
      title: "Get survey",
      description: "Get one Formbricks survey using the v3 Surveys API contract.",
      inputSchema: ZMcpGetSurveyInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input: TMcpGetSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const scopeError = await guardMcpScopes(extra.authInfo, ["surveys:read"], requestId);
      if (scopeError) {
        return scopeError;
      }

      const response = await getV3Survey({
        surveyId: input.surveyId,
        lang: input.lang,
        authentication: getMcpAuthentication(extra.authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  server.registerTool(
    "create_survey",
    {
      title: "Create survey",
      description: "Create a Formbricks link survey using the v3 Surveys API contract.",
      inputSchema: ZMcpCreateSurveyInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpCreateSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const scopeError = await guardMcpScopes(extra.authInfo, ["surveys:write"], requestId);
      if (scopeError) {
        return scopeError;
      }

      const authentication = getMcpAuthentication(extra.authInfo);
      const log = logger.withContext({ requestId, workspaceId: input.workspaceId });
      const auditLog = buildV3AuditLog(authentication, "created", "survey", MCP_API_ROUTE);

      try {
        const response = await createV3SurveyResponseFromRawInput({
          body: input,
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

  server.registerTool(
    "validate_survey",
    {
      title: "Validate survey",
      description: "Validate a v3 survey create or patch payload without writing survey changes.",
      inputSchema: ZMcpValidateSurveyInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input: TMcpValidateSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const requiredScopes =
        input.operation === "patch" || input.operation === "create" ? ["surveys:write"] : ["surveys:read"];

      const scopeError = await guardMcpScopes(extra.authInfo, requiredScopes, requestId);
      if (scopeError) {
        return scopeError;
      }

      const response = await validateV3SurveyFromRawInput({
        body: input,
        authentication: getMcpAuthentication(extra.authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  server.registerTool(
    "patch_survey",
    {
      title: "Patch survey",
      description: [
        "Update a Formbricks survey using the v3 Surveys API patch contract.",
        "Provided top-level arrays and objects replace that whole subtree.",
      ].join(" "),
      inputSchema: ZMcpPatchSurveyInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpPatchSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const scopeError = await guardMcpScopes(extra.authInfo, ["surveys:write"], requestId);
      if (scopeError) {
        return scopeError;
      }

      const authentication = getMcpAuthentication(extra.authInfo);
      const log = logger.withContext({ requestId, surveyId: input.surveyId });
      const auditLog = buildV3AuditLog(authentication, "updated", "survey", MCP_API_ROUTE);

      try {
        const response = await patchV3SurveyResponse({
          surveyId: input.surveyId,
          body: input.data,
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

  server.registerTool(
    "delete_survey",
    {
      title: "Delete survey",
      description: "Delete a Formbricks survey using the v3 Surveys API contract.",
      inputSchema: ZMcpDeleteSurveyInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpDeleteSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const scopeError = await guardMcpScopes(extra.authInfo, ["surveys:write"], requestId);
      if (scopeError) {
        return scopeError;
      }

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
