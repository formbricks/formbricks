export type FollowUpResult = {
  followUpId: string;
  status: "success" | "error" | "skipped";
  error?: string;
};

export enum FollowUpSendError {
  VALIDATION_ERROR = "validation_error",
  ORG_NOT_FOUND = "organization_not_found",
  SURVEY_NOT_FOUND = "survey_not_found",
  RESPONSE_NOT_FOUND = "response_not_found",
  RESPONSE_SURVEY_MISMATCH = "response_survey_mismatch",
  FOLLOW_UP_NOT_ALLOWED = "follow_up_not_allowed",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  UNEXPECTED_ERROR = "unexpected_error",
}
