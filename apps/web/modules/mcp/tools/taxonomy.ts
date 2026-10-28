import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getV3EnrichmentStatus } from "@/app/api/v3/unify-feedback/enrichment-status/lib/operations";
import {
  getV3TaxonomyNodeRecordCounts,
  getV3TaxonomyNodeRecords,
  getV3TaxonomyRun,
  getV3TaxonomyState,
  listV3TaxonomyFields,
  removeV3TaxonomyNode,
  renameV3TaxonomyNode,
  triggerV3TaxonomyRun,
} from "@/app/api/v3/unify-feedback/taxonomy/lib/operations";
import {
  ZV3EnrichmentStatusResource,
  ZV3TaxonomyFieldsResource,
  ZV3TaxonomyNode,
  ZV3TaxonomyNodeRecord,
  ZV3TaxonomyNodeRecordsMeta,
  ZV3TaxonomyRecordCountsResource,
  ZV3TaxonomyRun,
  ZV3TaxonomyRunStartResource,
  ZV3TaxonomyStateResource,
} from "@/app/api/v3/unify-feedback/taxonomy/lib/resources";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { ZMcpAcknowledgement, mcpToolOutput } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";
import {
  type TMcpGetEnrichmentStatusInput,
  type TMcpGetTaxonomyRecordCountsInput,
  type TMcpGetTaxonomyRunInput,
  type TMcpGetTaxonomyStateInput,
  type TMcpListTaxonomyFieldsInput,
  type TMcpListTaxonomyNodeRecordsInput,
  type TMcpRemoveTaxonomyNodeInput,
  type TMcpRenameTaxonomyNodeInput,
  type TMcpStartTaxonomyRunInput,
  ZMcpGetEnrichmentStatusInput,
  ZMcpGetTaxonomyRecordCountsInput,
  ZMcpGetTaxonomyRunInput,
  ZMcpGetTaxonomyStateInput,
  ZMcpListTaxonomyFieldsInput,
  ZMcpListTaxonomyNodeRecordsInput,
  ZMcpRemoveTaxonomyNodeInput,
  ZMcpRenameTaxonomyNodeInput,
  ZMcpStartTaxonomyRunInput,
} from "./taxonomy-schemas";

const READ_SCOPE: [string, ...string[]] = ["feedbackRecords:read"];
const WRITE_SCOPE: [string, ...string[]] = ["feedbackRecords:write"];

const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const ZMcpTaxonomyFieldsOutput = mcpToolOutput(ZV3TaxonomyFieldsResource);
const ZMcpTaxonomyStateOutput = mcpToolOutput(ZV3TaxonomyStateResource);
const ZMcpTaxonomyRunOutput = mcpToolOutput(ZV3TaxonomyRun);
const ZMcpTaxonomyRecordCountsOutput = mcpToolOutput(ZV3TaxonomyRecordCountsResource);
const ZMcpTaxonomyRunStartOutput = mcpToolOutput(ZV3TaxonomyRunStartResource);
// A node's records are a capped sample: `meta` is the applied limit only, not the cursor/total envelope
// the keyset-paged lists answer with.
const ZMcpTaxonomyNodeRecordsOutput = mcpToolOutput(z.array(ZV3TaxonomyNodeRecord)).extend({
  meta: ZV3TaxonomyNodeRecordsMeta.optional(),
});
const ZMcpTaxonomyNodeOutput = mcpToolOutput(ZV3TaxonomyNode);
const ZMcpEnrichmentStatusOutput = mcpToolOutput(ZV3EnrichmentStatusResource);

/** Shared body of the read tools: resolve the request id, run the v3 operation, relay its Response. */
function readHandler<TInput>(
  run: (
    input: TInput,
    authentication: ReturnType<typeof getMcpAuthentication>,
    requestId: string
  ) => Promise<Response>
) {
  return async (input: TInput, ctx: TMcpToolContext): Promise<CallToolResult> => {
    const authInfo = getMcpToolAuthInfo(ctx);
    const requestId = getMcpRequestId(authInfo);
    const response = await run(input, getMcpAuthentication(authInfo), requestId);
    return await responseToMcpToolResult(response, requestId);
  };
}

/**
 * Topics & Subtopics: the taxonomy Unify Feedback builds over a feedback dataset, and the enrichment
 * progress that feeds it. They ride on the feedback-record scopes (agent-first scope model, ADR 0015).
 *
 * The scope is the first gate. The operations then check workspace access, the `feedbackDirectories`
 * entitlement and that the dataset is assigned to the workspace; changing the tree is further limited to
 * organization owners and managers, or to an API key whose workspace owns the dataset alone.
 */
export function registerTaxonomyTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_taxonomy_fields",
    {
      title: "List taxonomy fields",
      description:
        "List the feedback fields topics can be generated for in a dataset, with record and embedding counts. Use it to pick the scope for start_taxonomy_run, and to check there is enough embedded text. `unavailable: true` means the feedback service did not answer, not that there are no fields.",
      inputSchema: ZMcpListTaxonomyFieldsInput,
      outputSchema: ZMcpTaxonomyFieldsOutput,
      annotations: READ_ANNOTATIONS,
    },
    READ_SCOPE,
    readHandler<TMcpListTaxonomyFieldsInput>((input, authentication, requestId) =>
      listV3TaxonomyFields({ ...input, authentication, requestId, instance: MCP_API_ROUTE })
    )
  );

  registerScopedTool(
    server,
    "get_taxonomy_state",
    {
      title: "Get taxonomy state",
      description:
        "Get the active topic tree (with node ids) and the five most recent runs for a scope. `activeTree` is null when no taxonomy has been generated yet; `unavailable: true` means the feedback service did not answer.",
      inputSchema: ZMcpGetTaxonomyStateInput,
      outputSchema: ZMcpTaxonomyStateOutput,
      annotations: READ_ANNOTATIONS,
    },
    READ_SCOPE,
    readHandler<TMcpGetTaxonomyStateInput>((input, authentication, requestId) =>
      getV3TaxonomyState({ ...input, authentication, requestId, instance: MCP_API_ROUTE })
    )
  );

  registerScopedTool(
    server,
    "get_taxonomy_run",
    {
      title: "Get taxonomy run",
      description:
        "Get one taxonomy run's status. Poll it after start_taxonomy_run until status is succeeded, failed or canceled; error_code says why a run failed.",
      inputSchema: ZMcpGetTaxonomyRunInput,
      outputSchema: ZMcpTaxonomyRunOutput,
      annotations: READ_ANNOTATIONS,
    },
    READ_SCOPE,
    readHandler<TMcpGetTaxonomyRunInput>((input, authentication, requestId) =>
      getV3TaxonomyRun({ ...input, authentication, requestId, instance: MCP_API_ROUTE })
    )
  );

  registerScopedTool(
    server,
    "get_taxonomy_record_counts",
    {
      title: "Get taxonomy record counts",
      description:
        "Count the distinct feedback records under every visible node of a taxonomy run, subtree totals included. One entry per node, keyed by node_id; use it to see which topics are big without listing records.",
      inputSchema: ZMcpGetTaxonomyRecordCountsInput,
      outputSchema: ZMcpTaxonomyRecordCountsOutput,
      annotations: READ_ANNOTATIONS,
    },
    READ_SCOPE,
    readHandler<TMcpGetTaxonomyRecordCountsInput>((input, authentication, requestId) =>
      getV3TaxonomyNodeRecordCounts({ ...input, authentication, requestId, instance: MCP_API_ROUTE })
    )
  );

  registerScopedTool(
    server,
    "list_taxonomy_node_records",
    {
      title: "List taxonomy node records",
      description:
        "Sample the feedback records classified under a topic node and its visible subtopics. A capped sample with no cursor and no total; use get_taxonomy_record_counts for how many there are.",
      inputSchema: ZMcpListTaxonomyNodeRecordsInput,
      outputSchema: ZMcpTaxonomyNodeRecordsOutput,
      annotations: READ_ANNOTATIONS,
    },
    READ_SCOPE,
    readHandler<TMcpListTaxonomyNodeRecordsInput>((input, authentication, requestId) =>
      getV3TaxonomyNodeRecords({ ...input, authentication, requestId, instance: MCP_API_ROUTE })
    )
  );

  registerScopedTool(
    server,
    "get_enrichment_status",
    {
      title: "Get enrichment status",
      description:
        "Get how far translation, sentiment and emotion enrichment has got across the feedback datasets of a workspace: eligible, done, permanently failed and pending records per enrichment. Only enabled enrichments are listed; `unavailable: true` means the feedback service did not answer.",
      inputSchema: ZMcpGetEnrichmentStatusInput,
      outputSchema: ZMcpEnrichmentStatusOutput,
      annotations: READ_ANNOTATIONS,
    },
    READ_SCOPE,
    readHandler<TMcpGetEnrichmentStatusInput>((input, authentication, requestId) =>
      getV3EnrichmentStatus({ ...input, authentication, requestId, instance: MCP_API_ROUTE })
    )
  );

  registerScopedTool(
    server,
    "start_taxonomy_run",
    {
      title: "Start taxonomy run",
      description:
        "Start (or resume) topic generation for a scope. Idempotent per scope: `inProgress: true` means a run was already going and its run is returned. Poll get_taxonomy_run, then read the tree with get_taxonomy_state. Changing topics needs an organization owner or manager, or an API key whose workspace owns the dataset alone.",
      inputSchema: ZMcpStartTaxonomyRunInput,
      outputSchema: ZMcpTaxonomyRunStartOutput,
      audit: { action: "created", targetType: "feedbackDirectory" },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    WRITE_SCOPE,
    async (input: TMcpStartTaxonomyRunInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "created", resource: "feedbackDirectory", logContext: { directoryId: input.directoryId } },
        ({ authentication, requestId, auditLog }) =>
          triggerV3TaxonomyRun({
            ...input,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "rename_taxonomy_node",
    {
      title: "Rename taxonomy node",
      description:
        "Rename a topic or subtopic in the dataset's taxonomy. Same access rule as start_taxonomy_run.",
      inputSchema: ZMcpRenameTaxonomyNodeInput,
      outputSchema: ZMcpTaxonomyNodeOutput,
      audit: { action: "updated", targetType: "feedbackDirectory", targetIdArg: "directoryId" },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    WRITE_SCOPE,
    async (input: TMcpRenameTaxonomyNodeInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "feedbackDirectory", logContext: { directoryId: input.directoryId } },
        ({ authentication, requestId, auditLog }) =>
          renameV3TaxonomyNode({
            ...input,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "remove_taxonomy_node",
    {
      title: "Remove taxonomy node",
      description:
        "Remove a topic or subtopic from the dataset's taxonomy. The node is excluded from the tree and there is no tool to restore it. Same access rule as start_taxonomy_run.",
      inputSchema: ZMcpRemoveTaxonomyNodeInput,
      outputSchema: ZMcpAcknowledgement,
      audit: { action: "deleted", targetType: "feedbackDirectory", targetIdArg: "directoryId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    WRITE_SCOPE,
    async (input: TMcpRemoveTaxonomyNodeInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "deleted", resource: "feedbackDirectory", logContext: { directoryId: input.directoryId } },
        ({ authentication, requestId, auditLog }) =>
          removeV3TaxonomyNode({
            ...input,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );
}
