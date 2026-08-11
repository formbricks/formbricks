import { env } from "@/lib/env";

// Archived surveys are permanently deleted after this many days (see ENG-1042).
export const SURVEY_ARCHIVE_RETENTION_DAYS = 30;

// Number of archived surveys purged per DB round-trip.
export const SURVEY_ARCHIVE_PURGE_BATCH_SIZE = 100;

// Daily at 01:30 in the same time zone as survey scheduling, offset from the scheduling job.
// Reuses the validated, server-only SURVEY_SCHEDULING_TIME_ZONE (single source of truth in
// apps/web/lib/env.ts), which already defaults to "Europe/Berlin".
export const SURVEY_ARCHIVE_PURGE_TIME_ZONE = env.SURVEY_SCHEDULING_TIME_ZONE;
export const SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN = "30 1 * * *";
