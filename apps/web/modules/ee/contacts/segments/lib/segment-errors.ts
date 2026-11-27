/**
 * The message `createSegment` and `updateSegment` refuse a title the workspace already uses with. Shared so
 * the internal segments routes can answer that refusal as a 409 rather than a generic invalid input.
 */
export const SEGMENT_TITLE_TAKEN_ERROR_MESSAGE = "A segment with this title already exists";
