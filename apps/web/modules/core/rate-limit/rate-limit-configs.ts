export const rateLimitConfigs = {
  // Authentication endpoints - stricter limits for security
  auth: {
    login: { interval: 900, allowedPerInterval: 30, namespace: "auth:login" }, // 30 per 15 minutes
    signup: { interval: 3600, allowedPerInterval: 30, namespace: "auth:signup" }, // 30 per hour
    forgotPassword: { interval: 3600, allowedPerInterval: 5, namespace: "auth:forgot" }, // 5 per hour
    verifyEmail: { interval: 3600, allowedPerInterval: 10, namespace: "auth:verify" }, // 10 per hour
  },

  // API endpoints - higher limits for legitimate usage
  api: {
    v1: { interval: 60, allowedPerInterval: 100, namespace: "api:v1" }, // 100 per minute
    v2: { interval: 60, allowedPerInterval: 100, namespace: "api:v2" }, // 100 per minute
    client: { interval: 60, allowedPerInterval: 100, namespace: "api:client" }, // 100 per minute
  },

  // Server actions - varies by action type
  actions: {
    emailUpdate: { interval: 3600, allowedPerInterval: 3, namespace: "action:email" }, // 3 per hour
    surveyFollowUp: { interval: 3600, allowedPerInterval: 50, namespace: "action:followup" }, // 50 per hour
  },

  // Share pages - moderate limits for public access
  share: {
    url: { interval: 60, allowedPerInterval: 30, namespace: "share:url" }, // 30 per minute
  },
};
