import type { McpServer } from "@modelcontextprotocol/server";
import { createV3Organization } from "@/app/api/v3/organizations/lib/create";
import {
  type TV3OrganizationCreatedResource,
  ZV3OrganizationCreatedResource,
} from "@/app/api/v3/organizations/lib/schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { registerScopedTool } from "./guard-scopes";
import { type TMcpCreateOrganizationInput, ZMcpCreateOrganizationInput } from "./organizations-schemas";
import { mcpToolOutput } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";

const ZMcpOrganizationCreatedOutput = mcpToolOutput(ZV3OrganizationCreatedResource);

/**
 * What the model reads after a create: the id, fixed words and the guide URL the instance itself built.
 * The name the person chose stays in `structuredContent` only, because organization names are written by
 * people and the text half is read as if it were an instruction (ADR 0017).
 */
export const summarizeCreatedOrganization = (organization: TV3OrganizationCreatedResource): string =>
  `Organization ${organization.id} created; the person is its owner and it has no workspace yet. Next: follow the new-owner path (Path A) of the Setup guide at ${organization.setupGuideUrl} for this organization.`;

export function registerOrganizationTools(server: McpServer): void {
  registerScopedTool(
    server,
    "create_organization",
    {
      title: "Create organization",
      description:
        "Create another organization that the person owns. Needs a signed-in person (not an API key), an instance with the multi-organization licence (or no organization yet), and is limited per person per day. Creates no workspace: the result carries the Setup guide URL and the next step, which is to run the guide's new-owner path for the new organization. Confirm the name with the person first.",
      inputSchema: ZMcpCreateOrganizationInput,
      outputSchema: ZMcpOrganizationCreatedOutput,
      // The organization does not exist yet, so there is no target to name for a refused call.
      audit: { action: "created", targetType: "organization" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ["organizations:write"],
    async (input: TMcpCreateOrganizationInput, ctx) => {
      const result = await runMcpMutation(
        ctx,
        { action: "created", resource: "organization" },
        ({ authentication, requestId, auditLog }) =>
          createV3Organization({
            body: input,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      );
      if (result.isError) return result;

      const parsed = ZV3OrganizationCreatedResource.safeParse(
        (result.structuredContent as { data?: unknown } | undefined)?.data
      );
      // A body that is not the expected shape gets a fixed line, never the raw JSON: the default text half
      // of a result is the whole body, name included.
      const text = parsed.success
        ? summarizeCreatedOrganization(parsed.data)
        : "Organization created. Details are in structuredContent.";
      return { ...result, content: [{ type: "text", text }] };
    }
  );
}
