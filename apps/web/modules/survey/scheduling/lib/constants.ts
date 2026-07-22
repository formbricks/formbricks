import { type TSurveySchedulingConfig, getSurveySchedulingTimeLabel } from "./config";

const parseSchedulingTimePart = (
  value: string | undefined,
  fallback: number,
  { min, max }: { min: number; max: number }
): number => {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < min || parsedValue > max) {
    return fallback;
  }

  return parsedValue;
};

// Read at runtime from server-only env vars (no NEXT_PUBLIC_ prefix) so self-hosted Docker
// deployments can configure the scheduling execution time without rebuilding the image. The
// editor UI receives these values as props instead of importing this module on the client.
export const SURVEY_SCHEDULING_TIME_ZONE = process.env.SURVEY_SCHEDULING_TIME_ZONE ?? "Europe/Berlin";
export const SURVEY_SCHEDULING_LOCAL_HOUR = parseSchedulingTimePart(
  process.env.SURVEY_SCHEDULING_LOCAL_HOUR,
  0,
  {
    min: 0,
    max: 23,
  }
);
export const SURVEY_SCHEDULING_LOCAL_MINUTE = parseSchedulingTimePart(
  process.env.SURVEY_SCHEDULING_LOCAL_MINUTE,
  0,
  { min: 0, max: 59 }
);

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
