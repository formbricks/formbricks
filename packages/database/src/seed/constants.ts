export const SEED_IDS = {
  USER_ADMIN: "clseedadmin000000000000",
  USER_MANAGER: "clseedmanager0000000000",
  USER_MEMBER: "clseedmember00000000000",
  ORGANIZATION: "clseedorg0000000000000",
  PROJECT: "clseedproject000000000",
  ENV_DEV: "clseedenvdev0000000000",
  ENV_PROD: "clseedenvprod000000000",
  SURVEY_KITCHEN_SINK: "clseedsurveykitchen00",
  SURVEY_CSAT: "clseedsurveycsat000000",
  SURVEY_DRAFT: "clseedsurveydraft00000",
  SURVEY_COMPLETED: "clseedsurveycomplete00",
  CHART_RESPONSES_OVER_TIME: "clseedchartresptime00",
  CHART_SATISFACTION_DIST: "clseedchartsatdist000",
  CHART_NPS_SCORE: "clseedchartnpsscore00",
  CHART_COMPLETION_RATE: "clseedchartcomplete00",
  CHART_TOP_CHANNELS: "clseedcharttopchann00",
  DASHBOARD_OVERVIEW: "clseeddashovervieww00",
  DASHBOARD_SURVEY_PERF: "clseeddashsurvperf000",
} as const;

export const SEED_CREDENTIALS = {
  ADMIN: { email: "admin@formbricks.com", password: "Password#123" },
  MANAGER: { email: "manager@formbricks.com", password: "Password#123" },
  MEMBER: { email: "member@formbricks.com", password: "Password#123" },
} as const;
