import { rateLimit } from "@/app/middleware/rate-limit";
import {
  CLIENT_SIDE_API_RATE_LIMIT,
  FORGET_PASSWORD_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
  SHARE_RATE_LIMIT,
  SIGNUP_RATE_LIMIT,
  SYNC_USER_IDENTIFICATION_RATE_LIMIT,
  VERIFY_EMAIL_RATE_LIMIT,
} from "@formbricks/lib/constants";

export const loginLimiter = rateLimit({
  interval: LOGIN_RATE_LIMIT.interval,
  allowedPerInterval: LOGIN_RATE_LIMIT.allowedPerInterval,
});
export const signupLimiter = rateLimit({
  interval: SIGNUP_RATE_LIMIT.interval,
  allowedPerInterval: SIGNUP_RATE_LIMIT.allowedPerInterval,
});
export const verifyEmailLimiter = rateLimit({
  interval: VERIFY_EMAIL_RATE_LIMIT.interval,
  allowedPerInterval: VERIFY_EMAIL_RATE_LIMIT.allowedPerInterval,
});
export const forgotPasswordLimiter = rateLimit({
  interval: FORGET_PASSWORD_RATE_LIMIT.interval,
  allowedPerInterval: FORGET_PASSWORD_RATE_LIMIT.allowedPerInterval,
});
export const clientSideApiEndpointsLimiter = rateLimit({
  interval: CLIENT_SIDE_API_RATE_LIMIT.interval,
  allowedPerInterval: CLIENT_SIDE_API_RATE_LIMIT.allowedPerInterval,
});

export const shareUrlLimiter = rateLimit({
  interval: SHARE_RATE_LIMIT.interval,
  allowedPerInterval: SHARE_RATE_LIMIT.allowedPerInterval,
});

export const syncUserIdentificationLimiter = rateLimit({
  interval: SYNC_USER_IDENTIFICATION_RATE_LIMIT.interval,
  allowedPerInterval: SYNC_USER_IDENTIFICATION_RATE_LIMIT.allowedPerInterval,
});
