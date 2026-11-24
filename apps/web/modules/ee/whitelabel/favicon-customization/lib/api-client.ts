import type { TOrganizationFaviconResource } from "@/app/api/internal/organizations/[organizationId]/favicon/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

const faviconPath = (organizationId: string) =>
  `/api/internal/organizations/${encodeURIComponent(organizationId)}/favicon`;

/** Set the favicon the organization's link surveys show. */
export const updateOrganizationFavicon = (organizationId: string, faviconUrl: string) =>
  sendApiRequest<TOrganizationFaviconResource>(faviconPath(organizationId), {
    method: "PUT",
    body: { faviconUrl },
  });

/** Go back to the default favicon on the organization's link surveys. */
export const removeOrganizationFavicon = (organizationId: string) =>
  sendApiRequest<void>(faviconPath(organizationId), { method: "DELETE" });
