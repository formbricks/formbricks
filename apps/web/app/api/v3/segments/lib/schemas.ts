import { z } from "zod";
import { ZSegmentFilters } from "@formbricks/types/segment";

/** Default and maximum page size of `GET /api/v3/segments`. A list item is small, so the ceiling is generous. */
export const V3_SEGMENTS_DEFAULT_LIMIT = 20;
export const V3_SEGMENTS_MAX_LIMIT = 100;

export const ZV3SegmentIdParams = z.object({ segmentId: z.cuid2() }).strict();

export const ZV3SegmentListQuery = z
  .object({
    workspaceId: z.cuid2(),
    limit: z.coerce.number().int().min(1).max(V3_SEGMENTS_MAX_LIMIT).default(V3_SEGMENTS_DEFAULT_LIMIT),
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict();

/**
 * The same tree the survey targeting uses (`ZSegmentFilters`: depth, node and survey-reference bounds
 * included), but never empty: a segment with no filter would match everybody, and the UI refuses to save
 * one.
 */
const ZV3SegmentFilters = ZSegmentFilters.refine((filters) => filters.length > 0, {
  error: "At least one filter is required",
});

const ZV3SegmentTitle = z.string().trim().min(1).max(255);
const ZV3SegmentDescription = z.string().max(1000);

export const ZV3CreateSegmentBody = z
  .object({
    workspaceId: z.cuid2(),
    title: ZV3SegmentTitle,
    description: ZV3SegmentDescription.optional(),
    filters: ZV3SegmentFilters,
  })
  .strict();

/**
 * `description: null` clears it. Linking a segment to surveys is not part of this body: it is a property
 * of a survey's targeting, not of the segment.
 */
export const ZV3PatchSegmentBody = z
  .object({
    title: ZV3SegmentTitle.optional(),
    description: ZV3SegmentDescription.nullable().optional(),
    filters: ZV3SegmentFilters.optional(),
  })
  .strict()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: "Provide at least one of title, description or filters",
  });

/** A survey that uses the segment, limited to the ones the caller may see. */
export const ZV3SegmentSurveyRef = z.object({ id: z.string(), name: z.string(), status: z.string() });

const segmentBase = {
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

/** A list entry: the handle and the text, without the filter tree or the surveys. */
export const ZV3SegmentListItem = z.object(segmentBase);

/**
 * `filters` is `unknown[]` on purpose. It is validated strictly on the way in, but a stored tree is read
 * back as it is: a segment saved before a rule tightened must stay readable, not turn every read into an
 * error.
 */
export const ZV3SegmentResource = z.object({
  ...segmentBase,
  filters: z.array(z.unknown()),
  surveys: z.array(ZV3SegmentSurveyRef),
});

export type TV3SegmentListQuery = z.infer<typeof ZV3SegmentListQuery>;
export type TV3CreateSegmentBody = z.infer<typeof ZV3CreateSegmentBody>;
export type TV3PatchSegmentBody = z.infer<typeof ZV3PatchSegmentBody>;
export type TV3SegmentResource = z.infer<typeof ZV3SegmentResource>;
