import "server-only";
import { INVITE_RATE_LIMIT_PER_24_HOURS, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { reserveRateLimitUsage, settleRateLimitUsage } from "@/modules/core/rate-limit/helpers";
import type { TRateLimitReservation } from "@/modules/core/rate-limit/rate-limit";
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

export const reserveInviteRateLimit = async (
  organizationId: string,
  recipients = 1
): Promise<TRateLimitReservation | undefined> =>
  reserveRateLimitUsage(await getInviteRateLimitConfig(organizationId), organizationId, recipients);

export const settleInviteRateLimit = async (
  reservation: TRateLimitReservation | undefined,
  successfulRecipients: number
): Promise<void> => settleRateLimitUsage(reservation, successfulRecipients);
