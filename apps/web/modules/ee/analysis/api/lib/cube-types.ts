/**
 * One row of a Cube result after the client has pivoted it: member id (`FeedbackRecords.npsScore`, or
 * `FeedbackRecords.collectedAt.day` for a time bucket) to its value.
 */
export type TCubeDataRow = Record<string, string | number | null | boolean | undefined>;
