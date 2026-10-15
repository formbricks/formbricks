import type { TOrganizationPatchBody } from "@/app/api/internal/organizations/schemas";
import type { TOrganizationSettingsResource } from "@/app/api/internal/organizations/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/organizations";

/** Rename the organization, or change its AI or display settings. Returns its settings as stored. */
export const updateOrganizationSettings = (organizationId: string, body: TOrganizationPatchBody) =>
  sendApiRequest<TOrganizationSettingsResource>(`${BASE_PATH}/${encodeURIComponent(organizationId)}`, {
    method: "PATCH",
    body,
  });

/** Delete the organization and every workspace in it. */
export const deleteOrganization = (organizationId: string) =>
  sendApiRequest<void>(`${BASE_PATH}/${encodeURIComponent(organizationId)}`, { method: "DELETE" });
