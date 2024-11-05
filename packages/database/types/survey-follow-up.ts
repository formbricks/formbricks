import { z } from "zod";

export const ZSurveyFollowUpTrigger = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("response"),
  }),
  z.object({
    type: z.literal("endings"),
    properties: z.object({
      endingIds: z.array(z.string().cuid2()),
    }),
  }),
]);

export type TSurveyFollowUpTrigger = z.infer<typeof ZSurveyFollowUpTrigger>;

export const ZSurveyFollowUpAction = z.object({
  type: z.literal("send-email"),
  properties: z.object({
    to: z.array(z.string().email()),
    from: z.string().email(),
    replyTo: z.array(z.string().email()),
    subject: z.string(),
    body: z.string(),
  }),
});

export type TSurveyFollowUpAction = z.infer<typeof ZSurveyFollowUpAction>;

export const ZSurveyFollowUp = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  trigger: ZSurveyFollowUpTrigger,
  action: ZSurveyFollowUpAction,
  surveyId: z.string().cuid2(),
});

export type TSurveyFollowUp = z.infer<typeof ZSurveyFollowUp>;
