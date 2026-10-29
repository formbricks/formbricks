import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZV3OrganizationCreateBody, ZV3OrganizationUpdateBody } from "@/app/api/v3/organizations/lib/schemas";

/**
 * Input of `create_organization`. The v3 body is the whole input: the new organization's owner is always
 * the caller, so there is no tenant, owner or role field to take from the model.
 */
export const ZMcpCreateOrganizationInput = ZV3OrganizationCreateBody;

export const ZMcpUpdateOrganizationInput = ZV3OrganizationUpdateBody.extend({
  organizationId: ZId.describe("Organization to rename. Take it from get_account_context."),
}).strict();

export type TMcpCreateOrganizationInput = z.infer<typeof ZMcpCreateOrganizationInput>;
export type TMcpUpdateOrganizationInput = z.infer<typeof ZMcpUpdateOrganizationInput>;
