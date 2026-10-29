import type { McpServer } from "@modelcontextprotocol/server";
import { createV3Organization } from "@/app/api/v3/organizations/lib/create";
import { updateV3Organization } from "@/app/api/v3/organizations/lib/operations";
import {
  type TV3OrganizationCreatedResource,
  ZV3OrganizationCreatedResource,
  ZV3OrganizationResource,
} from "@/app/api/v3/organizations/lib/schemas";
import { registerScopedTool } from "./guard-scopes";
import { runIdSummaryMutation } from "./id-summary-mutation";
import {
  type TMcpCreateOrganizationInput,
  type TMcpUpdateOrganizationInput,
  ZMcpCreateOrganizationInput,
  ZMcpUpdateOrganizationInput,
} from "./organizations-schemas";
import { mcpToolOutput } from "./output-schemas";
import { ORGANIZATION_WRITE_SCOPES } from "./setup-scopes";

const ZMcpOrganizationCreatedOutput = mcpToolOutput(ZV3OrganizationCreatedResource);
const ZMcpOrganizationOutput = mcpToolOutput(ZV3OrganizationResource);

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
    ORGANIZATION_WRITE_SCOPES,
    (input: TMcpCreateOrganizationInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "created", resource: "organization" },
        (args) => createV3Organization({ body: input, ...args }),
        ZV3OrganizationCreatedResource,
        summarizeCreatedOrganization
      )
  );

  registerScopedTool(
    server,
    "update_organization",
    {
      title: "Rename organization",
      description:
        "Rename an organization. Needs an organization owner or manager (as a signed-in person, not an API key). Only the name can be changed.",
      inputSchema: ZMcpUpdateOrganizationInput,
      outputSchema: ZMcpOrganizationOutput,
      audit: { action: "updated", targetType: "organization", targetIdArg: "organizationId" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ORGANIZATION_WRITE_SCOPES,
    ({ organizationId, ...body }: TMcpUpdateOrganizationInput, ctx) =>
      runIdSummaryMutation(
        ctx,
        { action: "updated", resource: "organization", logContext: { organizationId } },
        (args) => updateV3Organization({ organizationId, body, ...args }),
        ZV3OrganizationResource,
        (organization) => `Organization ${organization.id} saved.`
      )
  );
}
