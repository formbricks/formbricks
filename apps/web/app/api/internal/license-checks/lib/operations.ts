import "server-only";
import { AuthenticationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import {
  FAILED_FETCH_TTL_MS,
  FETCH_LICENSE_TTL_MS,
  LicenseApiError,
  clearLicenseCache,
  computeFreshLicenseState,
  fetchLicenseFresh,
  getCacheKeys,
} from "@/modules/ee/license-check/lib/license";
import { assertCanRecheckLicense } from "@/modules/ee/license-check/lib/recheck-authorization";
import type { TLicenseCheckResource } from "../schemas";

/**
 * `POST /api/internal/license-checks?workspaceId=`: fetch this instance's license fresh. The organization
 * is the workspace's, and the caller must manage it; a caller outside it gets the same 403 as one who
 * may not recheck.
 */
export async function recheckLicenseOperation({
  authentication,
  workspaceId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  workspaceId: string;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  if (IS_FORMBRICKS_CLOUD) {
    return problemForbidden(
      requestId,
      "License recheck is only available on self-hosted instances",
      instance
    );
  }
  const userId = authentication && "user" in authentication ? authentication.user.id : null;
  if (!userId) return problemForbidden(requestId, undefined, instance);

  try {
    await assertCanRecheckLicense(userId, await getOrganizationIdFromWorkspaceId(workspaceId));
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof OperationNotAllowedError) {
      return problemForbidden(requestId, "Only owners and managers can recheck the license", instance);
    }
    throw error;
  }

  // Clears the main license cache but keeps the previous result for the grace period, so a license
  // server that is briefly unreachable doesn't downgrade the instance on the spot.
  await clearLicenseCache();

  let freshLicense: Awaited<ReturnType<typeof fetchLicenseFresh>>;
  try {
    freshLicense = await fetchLicenseFresh();
  } catch (error) {
    // 400 = invalid license key, 403 = license bound to another instance: answers, not failures.
    if (error instanceof LicenseApiError && (error.status === 400 || error.status === 403)) {
      return successResponse<TLicenseCheckResource>(
        { active: false, status: error.status === 400 ? "invalid_license" : "instance_mismatch" },
        { requestId }
      );
    }
    throw error;
  }

  // Cached (or null when the fetch failed) so getEnterpriseLicense uses it; wrapped in `{ value }` so a
  // cached null can be told apart from a miss.
  const { FETCH_LICENSE_CACHE_KEY } = getCacheKeys();
  await cache.set(
    FETCH_LICENSE_CACHE_KEY,
    { value: freshLicense ?? null },
    freshLicense ? FETCH_LICENSE_TTL_MS : FAILED_FETCH_TTL_MS
  );

  const licenseState = await computeFreshLicenseState(freshLicense);
  return successResponse<TLicenseCheckResource>(
    { active: licenseState.active, status: licenseState.status },
    { requestId }
  );
}
