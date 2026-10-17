import { z } from "zod";
import { ZId } from "./common";

export const ZDisplay = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  contactId: z.cuid().nullable(),
  surveyId: z.cuid(),
});

export type TDisplay = z.infer<typeof ZDisplay>;

export const ZDisplayCreateInput = z.object({
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  userId: z
    .string()
    .max(255, {
      error: "User ID cannot exceed 255 characters",
    })
    .optional(),
  responseId: z.cuid2().optional(),
  /**
   * The creative whose click opened the survey (T4, ADR 0006). Kept only when the creative is in the
   * workspace and its Destination is this survey; otherwise the display is created without it.
   */
  // A malformed one (another id format, a wrong type) is dropped, never a 400: attribution must not
  // cost a display, whichever SDK sent it.
  creativeId: ZId.optional().catch(undefined),
});

export type TDisplayCreateInput = z.infer<typeof ZDisplayCreateInput>;

export const ZDisplayFilters = z.object({
  createdAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),
  responseIds: z.array(z.cuid2()).optional(),
});

export type TDisplayFilters = z.infer<typeof ZDisplayFilters>;

export const ZDisplayWithContact = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  surveyId: z.string(),
  contact: z
    .object({
      id: z.string(),
      attributes: z.record(z.string(), z.string()),
    })
    .nullable(),
});

export type TDisplayWithContact = z.infer<typeof ZDisplayWithContact>;
