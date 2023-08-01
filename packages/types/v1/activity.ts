import { z } from "zod";

export const ZActivityFeedItem = z.object({
  id: z.string().cuid2(),
  type: z.enum(["event", "attribute", "display"]),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  attributeLabel: z.string().nullable(),
  attributeValue: z.string().nullable(),
  eventLabel: z.string().nullable(),
  eventDescription: z.string().nullable(),
  eventType: z.string().nullable(),
  displaySurveyName: z.string().nullable(),
});

export type TActivityFeedItem = z.infer<typeof ZActivityFeedItem>;
