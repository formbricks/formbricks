import type { TLicenseCheckResource } from "@/app/api/internal/license-checks/schemas";
import { buildApiUrl, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/** Ask the license server about this instance's license now. Self-hosted only; owners and managers. */
export const recheckLicense = (workspaceId: string) =>
  sendApiRequest<TLicenseCheckResource>(buildApiUrl("/api/internal/license-checks", { workspaceId }), {
    method: "POST",
  });
