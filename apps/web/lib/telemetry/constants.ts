// Daily at 02:15 UTC, offset from the survey sweeps so the usage update does not contend with them.
// UTC rather than a product time zone on purpose: this is a machine-facing report to the license
// server, so its timing carries no calendar meaning for any user.
export const USAGE_TELEMETRY_DAILY_CRON_PATTERN = "15 2 * * *";
export const USAGE_TELEMETRY_TIME_ZONE = "UTC";
