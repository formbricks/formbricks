/**
 * The message `createSegment` and `updateSegment` refuse a title the workspace already uses with. Shared so
 * the internal segments routes can answer that refusal as a 409 rather than a generic invalid input.
 */
export const SEGMENT_TITLE_TAKEN_ERROR_MESSAGE = "A segment with this title already exists";

/**
 * ENG-7269: a segment write whose connected surveys changed after the caller was authorized — a survey
 * connected between the check and the write. The request was fine but the segment moved under it, so the
 * internal segment route answers 409 and the caller re-reads and retries.
 */
export class SegmentSurveysChangedError extends Error {
  constructor() {
    super("The segment's connected surveys changed while saving. Reload and try again.");
    this.name = "SegmentSurveysChangedError";
  }
}
