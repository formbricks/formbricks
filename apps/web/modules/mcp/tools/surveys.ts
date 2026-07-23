import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
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

export function registerSurveyTools(server: McpServer): void {
  registerScopedTool(
    server,
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
    ["surveys:read"],
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

  registerScopedTool(
    server,
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
    ["surveys:read"],
    async (input: TMcpGetSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
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

  registerScopedTool(
    server,
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
    ["surveys:write"],
    async (input: TMcpCreateSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
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

  registerScopedTool(
    server,
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
    ["surveys:read"],
    async (input: TMcpValidateSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      // validate_survey never persists changes (readOnlyHint) — a dry-run validation of a create or
      // patch payload only needs read access. The actual write permission is enforced by the v3 layer
      // when create_survey / patch_survey run.
      const response = await validateV3SurveyFromRawInput({
        body: input,
        authentication: getMcpAuthentication(extra.authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
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
    ["surveys:write"],
    async (input: TMcpPatchSurveyInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
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

  registerScopedTool(
    server,
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
    ["surveys:write"],
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
