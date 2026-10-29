import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import type { TMcpToolContext } from "../auth";
import { withIdSummary } from "./id-summary";
import { runMcpMutation } from "./run-mcp-mutation";

type TMutationAudit = Parameters<typeof runMcpMutation>[1];
type TMutationArgs = Parameters<Parameters<typeof runMcpMutation>[2]>[0] & { instance: typeof MCP_API_ROUTE };

/**
 * The shape every setup mutation tool shares: run the v3 operation inside the audit lifecycle with the
 * caller's authentication, then replace the text the model reads with an id-only summary (ADR 0017).
 * `run` gets the authentication, request id, audit log and `instance` the operation takes, so a tool is
 * `({ ...args }) => operation({ ...ids, body, ...args })`.
 */
export async function runIdSummaryMutation<TData>(
  ctx: TMcpToolContext,
  audit: TMutationAudit,
  run: (args: TMutationArgs) => Promise<Response>,
  schema: z.ZodType<TData>,
  summarize: (data: TData) => string
): Promise<CallToolResult> {
  return withIdSummary(
    await runMcpMutation(ctx, audit, (args) => run({ ...args, instance: MCP_API_ROUTE })),
    schema,
    summarize
  );
}
