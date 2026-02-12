"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  AuthenticationError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  FAILED_FETCH_TTL_MS,
  FETCH_LICENSE_TTL_MS,
  LicenseApiError,
  clearLicenseCache,
  computeFreshLicenseState,
  fetchLicenseFresh,
  getCacheKeys,
} from "./lib/license";

const ZRecheckLicenseAction = z.object({
  environmentId: ZId,
});

export type TRecheckLicenseAction = z.infer<typeof ZRecheckLicenseAction>;

export const recheckLicenseAction = authenticatedActionClient
  .schema(ZRecheckLicenseAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: TRecheckLicenseAction;
    }) => {
      // Rate limit: 5 rechecks per minute per user
      await applyRateLimit(rateLimitConfigs.actions.licenseRecheck, ctx.user.id);

      // Only allow on self-hosted instances
      if (IS_FORMBRICKS_CLOUD) {
        throw new OperationNotAllowedError("License recheck is only available on self-hosted instances");
      }

      // Get organization from environment
      const organization = await getOrganizationByEnvironmentId(parsedInput.environmentId);
      if (!organization) {
        throw new ResourceNotFoundError("Organization", null);
      }

      // Check user is owner or manager (not member)
      const currentUserMembership = await getMembershipByUserIdOrganizationId(ctx.user.id, organization.id);
      if (!currentUserMembership) {
        throw new AuthenticationError("User not a member of this organization");
      }

      if (currentUserMembership.role === "member") {
        throw new OperationNotAllowedError("Only owners and managers can recheck license");
      }

      // Clear main license cache (preserves previous result cache for grace period)
      // This prevents instant downgrade if the license server is temporarily unreachable
      await clearLicenseCache();

      const cacheKeys = getCacheKeys();
      let freshLicense: Awaited<ReturnType<typeof fetchLicenseFresh>>;

      try {
        freshLicense = await fetchLicenseFresh();
      } catch (error) {
        // 400 = invalid license key — return directly so the UI shows the correct message
        if (error instanceof LicenseApiError && error.status === 400) {
          return { active: false, status: "invalid_license" as const };
        }
        throw error;
      }

      // Cache the fresh result (or null if failed) so getEnterpriseLicense can use it.
      // Wrapped in { value: ... } so fetchLicense can distinguish cache miss from cached null.
      if (freshLicense) {
        await cache.set(cacheKeys.FETCH_LICENSE_CACHE_KEY, { value: freshLicense }, FETCH_LICENSE_TTL_MS);
      } else {
        await cache.set(cacheKeys.FETCH_LICENSE_CACHE_KEY, { value: null }, FAILED_FETCH_TTL_MS);
      }

      const licenseState = await computeFreshLicenseState(freshLicense);

      return {
        active: licenseState.active,
        status: licenseState.status,
      };
    }
  );
