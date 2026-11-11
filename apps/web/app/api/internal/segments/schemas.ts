import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  type TBaseFilters,
  type TSegmentFilter,
  type TSegmentFilterValue,
  ZSegmentCreateInput,
  ZSegmentUpdateInput,
} from "@formbricks/types/segment";
import { ATTRIBUTE_KEY_MAX_LENGTH } from "@/app/api/internal/contact-attribute-keys/schemas";
import { FILTER_TEXT_MAX_LENGTH } from "@/app/api/internal/lib/limits";
import { checkNumberRange, checkStringMax } from "@/app/api/internal/lib/value-bounds";

/**
 * Longest segment title and description a write may set: far above anything the segment dialogs show in
 * full, and generous enough that no stored segment is blocked from being saved again.
 */
export const SEGMENT_TITLE_MAX_LENGTH = 1000;
export const SEGMENT_DESCRIPTION_MAX_LENGTH = 10_000;

/**
 * Largest number a filter compares against, either sign: far beyond any attribute a contact carries, and
 * inside the range a double holds exactly, so the comparison means what it says.
 */
export const SEGMENT_FILTER_NUMBER_MAX = 1e15;
/** Longest relative-date window ("older than N days"), in its unit: 100,000 days is some 270 years. */
export const SEGMENT_RELATIVE_DATE_AMOUNT_MAX = 100_000;

type TPath = (string | number)[];

/** A filter's value: free text and dates capped, numbers bounded, a relative window a whole count. */
const checkFilterValue = (value: TSegmentFilterValue, path: TPath, ctx: z.RefinementCtx): void => {
  if (typeof value === "string") {
    checkStringMax(ctx, value, FILTER_TEXT_MAX_LENGTH, path);
  } else if (typeof value === "number") {
    checkNumberRange(ctx, value, { min: -SEGMENT_FILTER_NUMBER_MAX, max: SEGMENT_FILTER_NUMBER_MAX }, path);
  } else if (Array.isArray(value)) {
    value.forEach((bound, index) => checkStringMax(ctx, bound, FILTER_TEXT_MAX_LENGTH, [...path, index]));
  } else if (!("surveyScope" in value)) {
    // A survey-interaction value is bounded by its shared schema; this is the relative date.
    checkNumberRange(ctx, value.amount, { min: 1, max: SEGMENT_RELATIVE_DATE_AMOUNT_MAX, int: true }, [
      ...path,
      "amount",
    ]);
  }
};

/** What a leaf filter names: an attribute, person or device key capped, a segment by a well-formed id. */
const checkFilterRoot = (filter: TSegmentFilter, path: TPath, ctx: z.RefinementCtx): void => {
  const { root } = filter;
  const rootPath = [...path, "root"];
  switch (root.type) {
    case "attribute":
      checkStringMax(ctx, root.contactAttributeKey, ATTRIBUTE_KEY_MAX_LENGTH, [
        ...rootPath,
        "contactAttributeKey",
      ]);
      break;
    case "person":
      checkStringMax(ctx, root.personIdentifier, ATTRIBUTE_KEY_MAX_LENGTH, [...rootPath, "personIdentifier"]);
      break;
    case "device":
      checkStringMax(ctx, root.deviceType, ATTRIBUTE_KEY_MAX_LENGTH, [...rootPath, "deviceType"]);
      break;
    case "segment": {
      const parsed = ZId.safeParse(root.segmentId);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          path: [...rootPath, "segmentId"],
          message: parsed.error.issues[0].message,
        });
      }
      break;
    }
    case "surveyInteraction":
      break;
  }
};

/**
 * Bounds every free-form field in a parsed filter tree (CODING_STANDARDS.md "Input Limits"). The shared
 * `ZSegmentFilters` is recursive, so it can't be rebuilt with the caps, and the public APIs parse it too;
 * the route walks what it parsed instead. The shared schema has already held the tree to
 * `MAX_SEGMENT_FILTERS_PER_TREE` nodes and `MAX_SEGMENT_FILTER_DEPTH` levels, which bounds this walk.
 */
const checkSegmentFilters = (filters: TBaseFilters, ctx: z.RefinementCtx): void => {
  const pending: { group: TBaseFilters; path: TPath }[] = [{ group: filters, path: ["filters"] }];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { group, path: groupPath } = next;
    group.forEach(({ resource }, index) => {
      const path = [...groupPath, index, "resource"];
      if (Array.isArray(resource)) {
        pending.push({ group: resource, path });
        return;
      }
      checkFilterRoot(resource, path, ctx);
      checkFilterValue(resource.value, [...path, "value"], ctx);
    });
  }
};

/*
 * The filter tree keeps the shared `ZSegmentFilters` rules (at least one filter, the tree bounds, the
 * per-filter checks), as the public survey targeting does: it is recursive, which `strictDeep` cannot
 * rebuild, so unknown keys inside a filter are stripped rather than refused. Its free-form fields are
 * capped by `checkSegmentFilters` above.
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
  .strict()
  .superRefine((body, ctx) => checkSegmentFilters(body.filters, ctx));

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
  .strict()
  .superRefine((body, ctx) => {
    if (body.filters) checkSegmentFilters(body.filters, ctx);
  });

export type TSegmentUpdateBody = z.infer<typeof ZSegmentUpdateBody>;

export const ZSegmentParams = z.object({ segmentId: ZId }).strict();

/** `POST /api/internal/segments/{segmentId}/copies` body: the survey the copy is attached to. */
export const ZSegmentCopyBody = z.object({ surveyId: ZId }).strict();

export const ZSurveySegmentParams = z.object({ surveyId: ZId }).strict();

/** `PUT /api/internal/surveys/{surveyId}/segment` body: the saved segment the survey targets from now on. */
export const ZSurveySegmentBody = z.object({ segmentId: ZId }).strict();

export const ZContactAttributeKeyValuesParams = z.object({ contactAttributeKeyId: ZId }).strict();

export const ZWorkspaceSegmentFilterSurveysParams = z.object({ workspaceId: ZId }).strict();
