import type { TBaseFilters, TSegment } from "@formbricks/types/segment";
import { isDeepEqual } from "@/lib/utils/object";

/**
 * An edit of a shared segment open in the targeting card (ENG-6957): the segment, and its filters as
 * stored when "Edit segment" opened it or "Save changes" last saved it.
 *
 * A survey save writes only the survey's own private segment. A shared segment can be nested in other
 * segments and so in other surveys' targeting, so it is saved through the segment endpoints: the card's
 * "Save changes" (`updateSegmentAction`). Until then, the edit lives only in the editor. Held by the
 * survey editor rather than the card, which unmounts with the Settings tab.
 */
export type TSharedSegmentEdit = Readonly<{ segmentId: string; savedFilters: TBaseFilters }>;

/**
 * The shared-segment edit once the targeting card's segment or editor state changed: an edit of another
 * segment ends (Load, Clone, Reset); the editor open on a shared segment, however it got there ("Edit
 * segment", or a segment loaded while the editor was open), starts one with the filters it opened with;
 * an edit already open for the segment keeps the filters it started from. Returns `edit` itself when
 * nothing changes.
 */
export const nextSharedSegmentEdit = (
  edit: TSharedSegmentEdit | null,
  segment: TSegment | null | undefined,
  isEditorOpen: boolean
): TSharedSegmentEdit | null => {
  const current = edit && edit.segmentId === segment?.id ? edit : null;
  if (current || !isEditorOpen || !segment || segment.isPrivate) return current;
  return { segmentId: segment.id, savedFilters: segment.filters };
};

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
