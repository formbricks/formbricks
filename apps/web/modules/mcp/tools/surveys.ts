import type { McpServer } from "@modelcontextprotocol/server";
import {
  createV3SurveyResponseFromRawInput,
  deleteV3Survey,
  getV3Survey,
  listV3Surveys,
  patchV3SurveyResponse,
  validateV3SurveyFromRawInput,
} from "@/app/api/v3/surveys/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { runMcpMutation } from "./run-mcp-mutation";
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
      inputSchema: ZMcpListSurveysInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:read"],
    async (input: TMcpListSurveysInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3Surveys({
        searchParams: buildListSurveysSearchParams(input),
        authentication: getMcpAuthentication(authInfo),
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
      inputSchema: ZMcpGetSurveyInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:read"],
    async (input: TMcpGetSurveyInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await getV3Survey({
        surveyId: input.surveyId,
        lang: input.lang,
        authentication: getMcpAuthentication(authInfo),
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
      inputSchema: ZMcpCreateSurveyInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpCreateSurveyInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "created", resource: "survey", logContext: { workspaceId: input.workspaceId } },
        ({ authentication, requestId, auditLog }) =>
          createV3SurveyResponseFromRawInput({
            body: input,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "validate_survey",
    {
      title: "Validate survey",
      description: "Validate a v3 survey create or patch payload without writing survey changes.",
      inputSchema: ZMcpValidateSurveyInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:read"],
    async (input: TMcpValidateSurveyInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      // validate_survey never persists changes (readOnlyHint) — a dry-run validation of a create or
      // patch payload only needs read access, and validateV3Survey gates at "read" to match. The
      // actual write permission is enforced when create_survey / patch_survey run.
      const response = await validateV3SurveyFromRawInput({
        body: input,
        authentication: getMcpAuthentication(authInfo),
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
      inputSchema: ZMcpPatchSurveyInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpPatchSurveyInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "survey", logContext: { surveyId: input.surveyId } },
        ({ authentication, requestId, auditLog }) =>
          patchV3SurveyResponse({
            surveyId: input.surveyId,
            body: input.data,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "delete_survey",
    {
      title: "Delete survey",
      description: "Delete a Formbricks survey using the v3 Surveys API contract.",
      inputSchema: ZMcpDeleteSurveyInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["surveys:write"],
    async (input: TMcpDeleteSurveyInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "deleted", resource: "survey", logContext: { surveyId: input.surveyId } },
        ({ authentication, requestId, auditLog }) =>
          deleteV3Survey({
            surveyId: input.surveyId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}
