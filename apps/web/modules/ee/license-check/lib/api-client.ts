import type { TLicenseCheckResource } from "@/app/api/internal/license-checks/schemas";
import { buildApiUrl, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * Ask the license server about this instance's license now. Self-hosted only; owners and managers.
 * No client timeout: the server retries the license server for up to ~27 s, and aborting early would
 * report a failure for a check that still lands.
 */
export const recheckLicense = (workspaceId: string) =>
  sendApiRequest<TLicenseCheckResource>(buildApiUrl("/api/internal/license-checks", { workspaceId }), {
    method: "POST",
    timeoutMs: null,
  });
