// Daily at 02:45 UTC, after the 02:15 usage-telemetry report so the two never contend. UTC on
// purpose: a machine-facing snapshot whose timing carries no calendar meaning for any user.
export const WORKFLOWS_USAGE_SNAPSHOT_DAILY_CRON_PATTERN = "45 2 * * *";
export const WORKFLOWS_USAGE_SNAPSHOT_TIME_ZONE = "UTC";
