import { z } from "zod";
import { ZV3OrganizationCreateBody } from "@/app/api/v3/organizations/lib/schemas";

/**
 * Input of `create_organization`. The v3 body is the whole input: the new organization's owner is always
 * the caller, so there is no tenant, owner or role field to take from the model.
 */
export const ZMcpCreateOrganizationInput = ZV3OrganizationCreateBody;

export type TMcpCreateOrganizationInput = z.infer<typeof ZMcpCreateOrganizationInput>;
