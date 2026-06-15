import {
  type TWorkflowIdInput,
  ZCreateWorkflowInput,
  ZWorkflowListItem,
  ZWorkflowResource,
  zCursorPage,
} from "../contracts";
import {
  WorkflowForbiddenError,
  WorkflowInvalidInputError,
  toProblemResponse,
  validateOutput,
} from "../errors";
import { createdResponse, dataResponse, listResponse } from "../responses";
import type { WorkflowsService } from "../services/workflows.service";
import type { WorkflowApiContext } from "./context";
import { parseListWorkflowsQuery } from "./parse-list-query";
import { toWorkflowListItem, toWorkflowResource } from "./serializers";

// Matches the v3 API's default request-body limit (apps/web `request-body.ts`) for consistency.
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;

const ZWorkflowListPage = zCursorPage(ZWorkflowListItem);

const readJsonBody = async (req: Request): Promise<unknown> => {
  // Reject oversized payloads up front via Content-Length so we never buffer them into memory.
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
    throw new WorkflowInvalidInputError("Request body is too large.");
  }

  const text = await req.text();
  // Defense in depth: Content-Length may be absent (chunked) or understated.
  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BODY_BYTES) {
    throw new WorkflowInvalidInputError("Request body is too large.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WorkflowInvalidInputError("Malformed JSON body.");
  }
};

export interface WorkflowsHandlers {
  list: (req: Request, ctx: WorkflowApiContext) => Promise<Response>;
  create: (req: Request, ctx: WorkflowApiContext) => Promise<Response>;
  get: (ctx: WorkflowApiContext, params: TWorkflowIdInput) => Promise<Response>;
}

/**
 * Web-standard, framework-agnostic handlers for the v3 Workflows CRUD surface. Each handler:
 * parse/validate input with the contract schemas → authorize via the injected `ctx.authorize`
 * capability → call the service → serialize → validate the serialized output against the resource
 * schema → return the success envelope. Any thrown error is mapped (and logged) by
 * `toProblemResponse`, so handlers never leak or swallow.
 */
export const createWorkflowsHandlers = (service: WorkflowsService): WorkflowsHandlers => ({
  async list(req, ctx) {
    try {
      const input = parseListWorkflowsQuery(new URL(req.url).searchParams);

      const authorized = await ctx.authorize(input.workspaceId, "read");
      if (authorized instanceof Response) return authorized;

      const workflowPage = await service.listWorkflows({ ...input, workspaceId: authorized.workspaceId });

      const page = validateOutput(ZWorkflowListPage, {
        data: workflowPage.workflows.map(toWorkflowListItem),
        meta: { limit: input.limit, nextCursor: workflowPage.nextCursor },
      });

      return listResponse(page.data, page.meta, ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async create(req, ctx) {
    try {
      const input = ZCreateWorkflowInput.parse(await readJsonBody(req));

      const authorized = await ctx.authorize(input.workspaceId, "readWrite");
      if (authorized instanceof Response) return authorized;

      const created = await service.createWorkflow(
        { ...input, workspaceId: authorized.workspaceId },
        { createdBy: ctx.userId }
      );

      const resource = validateOutput(ZWorkflowResource, toWorkflowResource(created));

      return createdResponse(resource, `/api/v3/workflows/${resource.id}`, ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async get(ctx, params) {
    try {
      const row = await service.getWorkflowById(params.workflowId);
      // 403 (not 404) for unknown ids so existence is never leaked across workspaces.
      if (!row) throw new WorkflowForbiddenError();

      const authorized = await ctx.authorize(row.workspaceId, "read");
      if (authorized instanceof Response) return authorized;

      const resource = validateOutput(ZWorkflowResource, toWorkflowResource(row));

      return dataResponse(resource, ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },
});
