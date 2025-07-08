import { CLIENT_SIDE_API_RATE_LIMIT, SYNC_USER_IDENTIFICATION_RATE_LIMIT } from "@/lib/constants";
import { rateLimit } from "@/lib/utils/rate-limit";

export const clientSideApiEndpointsLimiter = rateLimit({
  interval: CLIENT_SIDE_API_RATE_LIMIT.interval,
  allowedPerInterval: CLIENT_SIDE_API_RATE_LIMIT.allowedPerInterval,
});

export const syncUserIdentificationLimiter = rateLimit({
  interval: SYNC_USER_IDENTIFICATION_RATE_LIMIT.interval,
  allowedPerInterval: SYNC_USER_IDENTIFICATION_RATE_LIMIT.allowedPerInterval,
});
