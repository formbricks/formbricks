import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSegmentCreateInput, ZSegmentUpdateInput } from "@formbricks/types/segment";

/**
 * Longest segment title and description a write may set: far above anything the segment dialogs show in
 * full, and generous enough that no stored segment is blocked from being saved again.
 */
export const SEGMENT_TITLE_MAX_LENGTH = 1000;
export const SEGMENT_DESCRIPTION_MAX_LENGTH = 10_000;

/*
 * The filter tree keeps the shared `ZSegmentFilters` rules (at least one filter, the tree bounds, the
 * per-filter checks), as the public survey targeting does: it is recursive, which `strictDeep` cannot
 * rebuild, so unknown keys inside a filter are stripped rather than refused.
 */

/**
 * `POST /api/internal/segments` body: `ZSegmentCreateInput`, strict and bounded. `isPrivate` defaults to
 * true, as the shared schema has it. `surveyId` is the survey the segment is created for, if any.
 */
export const ZSegmentCreateBody = z
  .object({
    workspaceId: ZId,
    title: z.string().max(SEGMENT_TITLE_MAX_LENGTH),
    description: z.string().max(SEGMENT_DESCRIPTION_MAX_LENGTH).optional(),
    isPrivate: ZSegmentCreateInput.shape.isPrivate,
    filters: ZSegmentCreateInput.shape.filters,
    surveyId: ZId.optional(),
  })
  .strict();

export type TSegmentCreateBody = z.infer<typeof ZSegmentCreateBody>;

/**
 * `PATCH /api/internal/segments/{segmentId}` body: `ZSegmentUpdateInput`, strict and bounded. Its `isPrivate`
 * keeps the shared schema's default, so a body without it saves the segment as private, as the server
 * action did.
 */
export const ZSegmentUpdateBody = z
  .object({
    title: z.string().max(SEGMENT_TITLE_MAX_LENGTH).optional(),
    description: z.string().max(SEGMENT_DESCRIPTION_MAX_LENGTH).nullable().optional(),
    isPrivate: ZSegmentUpdateInput.shape.isPrivate,
    filters: ZSegmentUpdateInput.shape.filters,
    surveys: ZSegmentUpdateInput.shape.surveys,
  })
  .strict();

export type TSegmentUpdateBody = z.infer<typeof ZSegmentUpdateBody>;

export const ZSegmentParams = z.object({ segmentId: ZId }).strict();

/** `POST /api/internal/segments/{segmentId}/copies` body: the survey the copy is attached to. */
export const ZSegmentCopyBody = z.object({ surveyId: ZId }).strict();

export const ZSurveySegmentParams = z.object({ surveyId: ZId }).strict();

/** `PUT /api/internal/surveys/{surveyId}/segment` body: the saved segment the survey targets from now on. */
export const ZSurveySegmentBody = z.object({ segmentId: ZId }).strict();

export const ZContactAttributeKeyValuesParams = z.object({ contactAttributeKeyId: ZId }).strict();

export const ZWorkspaceSegmentFilterSurveysParams = z.object({ workspaceId: ZId }).strict();
