const padSchedulingTimePart = (value: number): string => value.toString().padStart(2, "0");

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

// Use static NEXT_PUBLIC_* lookups so these values can be safely inlined into client bundles.
export const SURVEY_SCHEDULING_TIME_ZONE =
  process.env.NEXT_PUBLIC_SURVEY_SCHEDULING_TIME_ZONE ?? "Europe/Berlin";
export const SURVEY_SCHEDULING_LOCAL_HOUR = parseSchedulingTimePart(
  process.env.NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_HOUR,
  0,
  { min: 0, max: 23 }
);
export const SURVEY_SCHEDULING_LOCAL_MINUTE = parseSchedulingTimePart(
  process.env.NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_MINUTE,
  0,
  { min: 0, max: 59 }
);
export const SURVEY_SCHEDULING_TIME_LABEL = `${padSchedulingTimePart(SURVEY_SCHEDULING_LOCAL_HOUR)}:${padSchedulingTimePart(SURVEY_SCHEDULING_LOCAL_MINUTE)}`;
export const SURVEY_SCHEDULING_TIME_ZONE_LABEL = SURVEY_SCHEDULING_TIME_ZONE;
export const SURVEY_SCHEDULING_DAILY_CRON_PATTERN = `${SURVEY_SCHEDULING_LOCAL_MINUTE} ${SURVEY_SCHEDULING_LOCAL_HOUR} * * *`;
export const SURVEY_SCHEDULING_GLOBAL_SCOPE = "global";
export const SURVEY_SCHEDULING_DAILY_SCHEDULE_ID = "daily-survey-scheduling";
export const SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE = 250;
