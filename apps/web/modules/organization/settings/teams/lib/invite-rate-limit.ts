import "server-only";
import { INVITE_RATE_LIMIT_PER_24_HOURS, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { getBulkInvitePermission } from "@/modules/ee/license-check/lib/utils";

const CLOUD_BULK_INVITE_RATE_LIMIT_PER_24_HOURS = 500;

export const getInviteRateLimitConfig = async (organizationId: string): Promise<TRateLimitConfig> => {
  if (!IS_FORMBRICKS_CLOUD) {
    return {
      ...rateLimitConfigs.actions.inviteMember,
      allowedPerInterval: INVITE_RATE_LIMIT_PER_24_HOURS,
    };
  }

  const hasCloudBulkInviteEntitlement = await getBulkInvitePermission(organizationId);

  return {
    ...rateLimitConfigs.actions.inviteMember,
    allowedPerInterval: hasCloudBulkInviteEntitlement
      ? CLOUD_BULK_INVITE_RATE_LIMIT_PER_24_HOURS
      : rateLimitConfigs.actions.inviteMember.allowedPerInterval,
  };
};

export const applyInviteRateLimit = async (organizationId: string, recipients = 1): Promise<void> => {
  await applyRateLimit(await getInviteRateLimitConfig(organizationId), organizationId, recipients);
};
