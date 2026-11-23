import type { TBaseFilters, TSegment } from "@formbricks/types/segment";
import { isDeepEqual } from "@/lib/utils/object";

/**
 * An edit of a shared segment open in the targeting card (ENG-6957): the segment, and its filters as
 * stored when "Edit segment" opened it or "Save changes" last saved it.
 *
 * A survey save writes only the survey's own private segment. A shared segment can be nested in other
 * segments and so in other surveys' targeting, so it is saved through the segment endpoints: the card's
 * "Save changes" (`PATCH /api/internal/segments/{segmentId}`). Until then, the edit lives only in the
 * editor. Held by the survey editor rather than the card, which unmounts with the Settings tab.
 */
export type TSharedSegmentEdit = Readonly<{ segmentId: string; savedFilters: TBaseFilters }>;

/**
 * The edit "Edit segment" opens on a shared segment: its filters as they are now, unless an edit of this
 * segment is already open (the editor closed by a failed Load), which keeps the filters it started from.
 * Only that button starts one: it shows only for a segment no other survey uses. A private segment (shown
 * with the button after a failed Load closed its editor) starts none: the survey save writes it.
 */
export const startSharedSegmentEdit = (
  edit: TSharedSegmentEdit | null,
  segment: TSegment
): TSharedSegmentEdit | null => {
  if (segment.isPrivate) return edit;
  return edit?.segmentId === segment.id ? edit : { segmentId: segment.id, savedFilters: segment.filters };
};

/** The edit once the survey is on `segmentId`: an edit of another segment ends (Load, Clone, Reset). */
export const keepSharedSegmentEditFor = (
  edit: TSharedSegmentEdit | null,
  segmentId: string | undefined
): TSharedSegmentEdit | null => (edit?.segmentId === segmentId ? edit : null);

/** Whether `segment` carries filter changes of the open shared-segment edit that are not saved yet. */
export const hasUnsavedSharedSegmentEdit = (
  segment: TSegment | null | undefined,
  edit: TSharedSegmentEdit | null
): boolean =>
  !!segment &&
  !!edit &&
  !segment.isPrivate &&
  segment.id === edit.segmentId &&
  !isDeepEqual(segment.filters, edit.savedFilters);

/**
 * Whether Save and Publish stop for an unsaved shared-segment edit: only on an app survey, the one that
 * keeps its segment. Any other survey leaves the segment on save, and has no targeting card to save it in.
 */
export const isSaveBlockedBySharedSegmentEdit = (
  survey: Readonly<{ type: string; segment: TSegment | null }>,
  edit: TSharedSegmentEdit | null
): boolean => survey.type === "app" && hasUnsavedSharedSegmentEdit(survey.segment, edit);

/**
 * The survey the draft autosave sends while a shared-segment edit is open: the segment as stored, which
 * the save leaves as it is anyway. The survey's other edits keep saving, the autosave does not hand the
 * stored filters back over the card's edit, and an open edit alone does not read as a change to save.
 * `persistedSegment` is the last saved survey's segment. It goes out only while it is the state the edit
 * opened on: right after Clone or Load it is another segment, and after "Save changes" its filters may be
 * older than the stored ones. Otherwise only the filters are put back.
 */
export const withSavedSharedSegment = <TSurvey extends { segment: TSegment | null }>(
  survey: TSurvey,
  edit: TSharedSegmentEdit | null,
  persistedSegment: TSegment | null | undefined
): TSurvey => {
  const { segment } = survey;
  if (!edit || !segment || segment.isPrivate || segment.id !== edit.segmentId) return survey;
  if (persistedSegment?.id === edit.segmentId && isDeepEqual(persistedSegment.filters, edit.savedFilters)) {
    return { ...survey, segment: persistedSegment };
  }
  return hasUnsavedSharedSegmentEdit(segment, edit)
    ? { ...survey, segment: { ...segment, filters: edit.savedFilters } }
    : survey;
};
