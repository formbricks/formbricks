import type { TCreatedOrganizationResource } from "@/app/api/internal/organizations/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * Create another organization from the organization settings, with the caller as its owner and a first
 * workspace. Needs the multi-organization licence; throws a `V3ApiError` with the server's reason otherwise.
 */
export const createAdditionalOrganization = (name: string) =>
  sendApiRequest<TCreatedOrganizationResource>("/api/internal/organizations", {
    method: "POST",
    body: { name, flow: "additional" },
  });
