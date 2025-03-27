import { z } from "zod";

export const ZContactLinksBySegmentParams = z.object({
  surveyId: z.string().cuid2().describe("The ID of the survey"),
  segmentId: z.string().cuid2().describe("The ID of the segment"),
});

export const ZContactLinksBySegmentQuery = z.object({
  expirationDays: z.coerce
    .number()
    .min(1)
    .max(365)
    .nullish()
    .default(null)
    .describe("Number of days until the generated JWT expires. If not provided, there is no expiration."),
  limit: z.coerce.number().min(1).max(10).optional().default(10).describe("Number of items to return"),
  skip: z.coerce.number().min(0).optional().default(0).describe("Number of items to skip"),
});

type TContactWithAttributes = {
  id: string;
} & Record<string, string>;

export type TGetSegmentContactsResponseData = {
  data: Array<TContactWithAttributes>;
  meta: {
    total: number;
  };
};
