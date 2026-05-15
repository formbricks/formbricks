export const rateLimitConfigs = {
  // Authentication endpoints - stricter limits for security
  auth: {
    login: { interval: 900, allowedPerInterval: 10, namespace: "auth:login" }, // 10 per 15 minutes
    signup: { interval: 3600, allowedPerInterval: 30, namespace: "auth:signup" }, // 30 per hour
    forgotPassword: { interval: 3600, allowedPerInterval: 5, namespace: "auth:forgot" }, // 5 per hour
    verifyEmail: { interval: 3600, allowedPerInterval: 10, namespace: "auth:verify" }, // 10 per hour
  },

  // API endpoints - higher limits for legitimate usage
  api: {
    v1: { interval: 60, allowedPerInterval: 100, namespace: "api:v1" }, // 100 per minute (Management API)
    v2: { interval: 60, allowedPerInterval: 100, namespace: "api:v2" }, // 100 per minute
    v3: { interval: 60, allowedPerInterval: 100, namespace: "api:v3" }, // 100 per minute
    client: { interval: 60, allowedPerInterval: 100, namespace: "api:client" }, // 100 per minute (Client API)
    clientEnvironment: {
      interval: 60,
      allowedPerInterval: 1000,
      namespace: "api:client:environment",
    }, // 1000 per minute per environment (Client API)
  },

  // Server actions - varies by action type
  actions: {
    emailUpdate: { interval: 3600, allowedPerInterval: 3, namespace: "action:email" }, // 3 per hour
    accountDeletion: { interval: 3600, allowedPerInterval: 5, namespace: "action:account-delete" }, // 5 per hour
    surveyFollowUp: { interval: 3600, allowedPerInterval: 50, namespace: "action:followup" }, // 50 per hour
    sendLinkSurveyEmail: {
      interval: 3600,
      allowedPerInterval: 10,
      namespace: "action:send-link-survey-email",
    }, // 10 per hour
    licenseRecheck: { interval: 60, allowedPerInterval: 5, namespace: "action:license-recheck" }, // 5 per minute
  },

  storage: {
    upload: { interval: 60, allowedPerInterval: 5, namespace: "storage:upload" }, // 5 per minute
    uploadPerEnvironment: {
      interval: 60,
      allowedPerInterval: 100,
      namespace: "storage:upload:environment",
    }, // 100 per minute per environment
    delete: { interval: 60, allowedPerInterval: 5, namespace: "storage:delete" }, // 5 per minute
  },
} as const;
