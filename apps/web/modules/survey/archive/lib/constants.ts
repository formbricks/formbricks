// Archived surveys are permanently deleted after this many days (see ENG-1042).
export const SURVEY_ARCHIVE_RETENTION_DAYS = 30;

// Number of archived surveys purged per DB round-trip.
export const SURVEY_ARCHIVE_PURGE_BATCH_SIZE = 100;

// Daily at 01:30 in the same time zone as survey scheduling, offset from the scheduling job.
export const SURVEY_ARCHIVE_PURGE_TIME_ZONE =
  process.env.NEXT_PUBLIC_SURVEY_SCHEDULING_TIME_ZONE ?? "Europe/Berlin";
export const SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN = "30 1 * * *";
export const SURVEY_ARCHIVE_PURGE_GLOBAL_SCOPE = "global";
export const SURVEY_ARCHIVE_PURGE_DAILY_SCHEDULE_ID = "daily-survey-archive-purge";
