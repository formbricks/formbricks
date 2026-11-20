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
 * The survey the draft autosave sends: an unsaved shared-segment edit goes out as its stored filters. The
 * save would not write them anyway, so the survey's other edits keep saving, the autosave does not hand
 * the stored filters back over the card's edit, and the leave-page check still counts it as unsaved.
 */
export const withSavedSharedSegmentFilters = <TSurvey extends { segment: TSegment | null }>(
  survey: TSurvey,
  edit: TSharedSegmentEdit | null
): TSurvey =>
  edit && survey.segment && hasUnsavedSharedSegmentEdit(survey.segment, edit)
    ? { ...survey, segment: { ...survey.segment, filters: edit.savedFilters } }
    : survey;
