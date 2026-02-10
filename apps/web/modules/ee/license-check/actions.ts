"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthenticationError, OperationNotAllowedError } from "@formbricks/types/errors";
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
  clearLicenseCache,
  fetchLicenseFresh,
  getCacheKeys,
  getEnterpriseLicense,
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
        throw new Error("Organization not found");
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

      // Fetch fresh license directly (bypasses cache)
      const freshLicense = await fetchLicenseFresh();

      // Cache the fresh result (or null if failed) so getEnterpriseLicense can use it
      const cacheKeys = getCacheKeys();

      if (freshLicense) {
        // Success - cache with full TTL
        await cache.set(cacheKeys.FETCH_LICENSE_CACHE_KEY, freshLicense, FETCH_LICENSE_TTL_MS);
      } else {
        // Failure - cache null with short TTL
        // The previous result cache is preserved, so grace period will still work
        await cache.set(cacheKeys.FETCH_LICENSE_CACHE_KEY, null, FAILED_FETCH_TTL_MS);
      }

      // Now get the license state - it should use the fresh data we just cached
      // If fetch failed, it will fall back to the preserved previous result (grace period)
      const licenseState = await getEnterpriseLicense();

      return {
        active: licenseState.active,
        status: licenseState.status,
      };
    }
  );
