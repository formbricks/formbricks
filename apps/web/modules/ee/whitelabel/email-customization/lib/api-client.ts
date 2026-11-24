import type { TOrganizationEmailLogoResource } from "@/app/api/internal/organizations/[organizationId]/email-logo/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

const organizationPath = (organizationId: string) =>
  `/api/internal/organizations/${encodeURIComponent(organizationId)}`;

/** Set the logo the organization's emails show in their header. */
export const updateOrganizationEmailLogo = (organizationId: string, logoUrl: string) =>
  sendApiRequest<TOrganizationEmailLogoResource>(`${organizationPath(organizationId)}/email-logo`, {
    method: "PUT",
    body: { logoUrl },
  });

/** Go back to the Formbricks logo in the organization's emails. */
export const removeOrganizationEmailLogo = (organizationId: string) =>
  sendApiRequest<void>(`${organizationPath(organizationId)}/email-logo`, { method: "DELETE" });

/**
 * Email the signed-in user a preview of the organization's customized email. No client timeout: the
 * server waits on the SMTP server, and giving up early would report a failure for an email that arrives.
 */
export const sendOrganizationTestEmail = (organizationId: string) =>
  sendApiRequest<{ emailSent: boolean }>(`${organizationPath(organizationId)}/test-emails`, {
    method: "POST",
    timeoutMs: null,
  });
