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
} as const;

export const SEED_CREDENTIALS = {
  ADMIN: { email: "admin@formbricks.com", password: "password123" },
  MANAGER: { email: "manager@formbricks.com", password: "password123" },
  MEMBER: { email: "member@formbricks.com", password: "password123" },
} as const;
