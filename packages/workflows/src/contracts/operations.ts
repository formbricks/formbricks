import { type z } from "zod";
import { ZWorkflowIdInput, ZWorkflowRunIdInput, zCursorPage } from "./common";
import type { TCursorPage, TWorkflowIdInput, TWorkflowRunIdInput } from "./common";
import {
  ZCreateWorkflowInput,
  ZDuplicateWorkflowInput,
  ZListWorkflowRunsInput,
  ZListWorkflowsInput,
  ZPatchWorkflowInput,
  ZTestWorkflowInput,
} from "./inputs";
import type {
  TCreateWorkflowInput,
  TDuplicateWorkflowInput,
  TListWorkflowRunsInput,
  TListWorkflowsInput,
  TPatchWorkflowInput,
  TTestWorkflowInput,
} from "./inputs";
import { ZWorkflowListItem, ZWorkflowResource, ZWorkflowRunResource, ZWorkflowRunSummary } from "./resources";
import type {
  TWorkflowListItem,
  TWorkflowResource,
  TWorkflowRunResource,
  TWorkflowRunSummary,
} from "./resources";

/**
 * Route-agnostic operation contracts for the v3 Workflows API (ENG-1101). Keys match the
 * operationIds in docs/api-v3-reference (the OpenAPI representation of the same contract).
 * HTTP handlers parse transport input into `params`/`input` and serialize `output`; other
 * consumers (jobs, MCP tools, tests) can import the same shapes directly.
 */
export const WORKFLOW_API_OPERATIONS = {
  listWorkflowsV3: {
    params: null,
    input: ZListWorkflowsInput,
    output: zCursorPage(ZWorkflowListItem),
  },
  createWorkflowV3: {
    params: null,
    input: ZCreateWorkflowInput,
    output: ZWorkflowResource,
  },
  getWorkflowV3: {
    params: ZWorkflowIdInput,
    input: null,
    output: ZWorkflowResource,
  },
  patchWorkflowV3: {
    params: ZWorkflowIdInput,
    input: ZPatchWorkflowInput,
    output: ZWorkflowResource,
  },
  deleteWorkflowV3: {
    params: ZWorkflowIdInput,
    input: null,
    output: null,
  },
  duplicateWorkflowV3: {
    params: ZWorkflowIdInput,
    input: ZDuplicateWorkflowInput,
    output: ZWorkflowResource,
  },
  enableWorkflowV3: {
    params: ZWorkflowIdInput,
    input: null,
    output: ZWorkflowResource,
  },
  disableWorkflowV3: {
    params: ZWorkflowIdInput,
    input: null,
    output: ZWorkflowResource,
  },
  archiveWorkflowV3: {
    params: ZWorkflowIdInput,
    input: null,
    output: ZWorkflowResource,
  },
  unarchiveWorkflowV3: {
    params: ZWorkflowIdInput,
    input: null,
    output: ZWorkflowResource,
  },
  testWorkflowV3: {
    params: ZWorkflowIdInput,
    input: ZTestWorkflowInput,
    output: ZWorkflowRunResource,
  },
  listWorkflowRunsV3: {
    params: null,
    input: ZListWorkflowRunsInput,
    output: zCursorPage(ZWorkflowRunSummary),
  },
  getWorkflowRunV3: {
    params: ZWorkflowRunIdInput,
    input: null,
    output: ZWorkflowRunResource,
  },
} as const satisfies Record<
  string,
  { params: z.ZodType | null; input: z.ZodType | null; output: z.ZodType | null }
>;

export type TWorkflowApiOperationId = keyof typeof WORKFLOW_API_OPERATIONS;

/**
 * Implementation contract for the operations above. Route handlers and future service layers
 * implement this; `deleteWorkflowV3` resolves to void (HTTP 204). Lifecycle, executability,
 * and idempotency failures are thrown as domain errors and mapped to problem details by the
 * transport layer.
 */
export interface TWorkflowsApiContract {
  listWorkflows: (input: TListWorkflowsInput) => Promise<TCursorPage<TWorkflowListItem>>;
  createWorkflow: (input: TCreateWorkflowInput) => Promise<TWorkflowResource>;
  getWorkflow: (params: TWorkflowIdInput) => Promise<TWorkflowResource>;
  patchWorkflow: (params: TWorkflowIdInput, input: TPatchWorkflowInput) => Promise<TWorkflowResource>;
  deleteWorkflow: (params: TWorkflowIdInput) => Promise<void>;
  duplicateWorkflow: (params: TWorkflowIdInput, input: TDuplicateWorkflowInput) => Promise<TWorkflowResource>;
  enableWorkflow: (params: TWorkflowIdInput) => Promise<TWorkflowResource>;
  disableWorkflow: (params: TWorkflowIdInput) => Promise<TWorkflowResource>;
  archiveWorkflow: (params: TWorkflowIdInput) => Promise<TWorkflowResource>;
  unarchiveWorkflow: (params: TWorkflowIdInput) => Promise<TWorkflowResource>;
  testWorkflow: (params: TWorkflowIdInput, input: TTestWorkflowInput) => Promise<TWorkflowRunResource>;
  listWorkflowRuns: (input: TListWorkflowRunsInput) => Promise<TCursorPage<TWorkflowRunSummary>>;
  getWorkflowRun: (params: TWorkflowRunIdInput) => Promise<TWorkflowRunResource>;
}
