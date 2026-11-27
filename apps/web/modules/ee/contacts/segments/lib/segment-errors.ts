/**
 * The message `createSegment` and `updateSegment` refuse a title the workspace already uses with. Shared so
 * the internal segments routes can answer that refusal as a 409 rather than a generic invalid input.
 */
export const SEGMENT_TITLE_TAKEN_ERROR_MESSAGE = "A segment with this title already exists";

/**
 * ENG-7269: a segment write whose segment changed after the caller was authorized — a survey connected, or
 * its filters changed, between the check and the write. The request was fine but the segment moved under
 * it, so the internal segment route answers 409 and the caller re-reads and retries.
 */
export class SegmentSurveysChangedError extends Error {
  constructor() {
    super("The segment changed while saving. Reload and try again.");
    this.name = "SegmentSurveysChangedError";
  }
}

/**
 * ENG-7269: the refusal for changing a private segment's filters while another segment's filters nest it
 * (only possible in data written before nesting a private segment was refused). Changing it would change
 * the audience of every survey on the nesting segment, which this survey's save may not do.
 */
export const PRIVATE_SEGMENT_NESTED_ELSEWHERE_MESSAGE =
  "This survey's targeting is used inside another segment, so changing it would change other surveys' targeting. Remove it from that segment first.";

/** ENG-7269: a reset refused because the survey's private segment is linked to other surveys too. */
export const PRIVATE_SEGMENT_SHARED_WITH_OTHER_SURVEYS_MESSAGE =
  "This survey's targeting segment is also used by other surveys, so it can't be reset here.";
