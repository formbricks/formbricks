import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSurveySlug } from "@formbricks/types/surveys/types";

/** Longest pretty URL slug a write may set: far longer than anyone types, and one URL path segment. */
export const SURVEY_SLUG_MAX_LENGTH = 255;

export const ZSurveySlugParams = z.object({ surveyId: ZId }).strict();

/** The survey's pretty URL, `/p/{slug}`: lowercase letters, numbers and hyphens. */
export const ZSurveySlugPutBody = z.object({ slug: ZSurveySlug.max(SURVEY_SLUG_MAX_LENGTH) }).strict();

export type TSurveySlugPutBody = z.infer<typeof ZSurveySlugPutBody>;
