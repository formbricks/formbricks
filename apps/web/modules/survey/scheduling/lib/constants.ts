import { env } from "@/lib/env";
import { type TSurveySchedulingConfig, getSurveySchedulingTimeLabel } from "./config";

// Read at runtime from server-only env vars (no NEXT_PUBLIC_ prefix) so self-hosted Docker
// deployments can configure the scheduling execution time without rebuilding the image. Values
// are validated and normalized in apps/web/lib/env.ts (single source of truth): the time zone is
// checked against Intl.DateTimeFormat and hour/minute are coerced to their valid ranges, so a bad
// override is rejected there instead of silently reaching Intl.DateTimeFormat here. The editor UI
// receives these values as props instead of importing this module on the client.
export const SURVEY_SCHEDULING_TIME_ZONE = env.SURVEY_SCHEDULING_TIME_ZONE;
export const SURVEY_SCHEDULING_LOCAL_HOUR = env.SURVEY_SCHEDULING_LOCAL_HOUR;
export const SURVEY_SCHEDULING_LOCAL_MINUTE = env.SURVEY_SCHEDULING_LOCAL_MINUTE;

export const SURVEY_SCHEDULING_CONFIG: TSurveySchedulingConfig = {
  timeZone: SURVEY_SCHEDULING_TIME_ZONE,
  localHour: SURVEY_SCHEDULING_LOCAL_HOUR,
  localMinute: SURVEY_SCHEDULING_LOCAL_MINUTE,
};

export const SURVEY_SCHEDULING_TIME_LABEL = getSurveySchedulingTimeLabel(SURVEY_SCHEDULING_CONFIG);
export const SURVEY_SCHEDULING_TIME_ZONE_LABEL = SURVEY_SCHEDULING_TIME_ZONE;
export const SURVEY_SCHEDULING_DAILY_CRON_PATTERN = `${SURVEY_SCHEDULING_LOCAL_MINUTE} ${SURVEY_SCHEDULING_LOCAL_HOUR} * * *`;
export const SURVEY_SCHEDULING_GLOBAL_SCOPE = "global";
export const SURVEY_SCHEDULING_DAILY_SCHEDULE_ID = "daily-survey-scheduling";
export const SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE = 250;
