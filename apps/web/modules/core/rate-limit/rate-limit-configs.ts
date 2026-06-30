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
    v3SurveyGenerate: {
      interval: 60,
      allowedPerInterval: 10,
      namespace: "api:v3:surveys:generate",
    }, // 10 per minute (AI survey generation)
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
    isSurveyResponsePresent: {
      interval: 60,
      allowedPerInterval: 10,
      namespace: "action:survey-response-present",
    }, // 10 per minute — prevents email-enumeration oracle
    validateSurveyPin: {
      interval: 60,
      allowedPerInterval: 10,
      namespace: "action:validate-survey-pin",
    }, // 10 per minute — prevents brute-force PIN guessing
    licenseRecheck: { interval: 60, allowedPerInterval: 5, namespace: "action:license-recheck" }, // 5 per minute
    inviteMember: { interval: 3600 * 24, allowedPerInterval: 20, namespace: "action:invite-member" }, // 20 per day  — bounds invite-spam abuse
    bulkInviteMembers: {
      interval: 3600 * 24,
      allowedPerInterval: 5,
      namespace: "action:bulk-invite-members",
    }, // 5 bulk imports per day per org
    generateExampleResponses: {
      interval: 60,
      allowedPerInterval: 1,
      namespace: "action:generate-example-responses",
    }, // 1 per minute per user — closes the multi-click race and bounds LLM spend
  },

  storage: {
    upload: { interval: 60, allowedPerInterval: 5, namespace: "storage:upload" }, // 5 per minute
    uploadPerWorkspace: {
      interval: 60,
      allowedPerInterval: 100,
      namespace: "storage:upload:workspace",
    }, // 100 per minute per workspace
    delete: { interval: 60, allowedPerInterval: 5, namespace: "storage:delete" }, // 5 per minute
  },
} as const;
