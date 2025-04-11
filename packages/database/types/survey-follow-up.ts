import { z } from "zod";

export const ZSurveyFollowUpTrigger = z
  .object({
    type: z.enum(["response", "endings"]),
    properties: z
      .object({
        endingIds: z.array(z.string().cuid2()),
      })
      .nullable(),
  })
  .superRefine((trigger, ctx) => {
    if (trigger.type === "response") {
      if (trigger.properties) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Properties should be null for response type",
        });
      }
    }

    if (trigger.type === "endings") {
      if (!trigger.properties) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Properties must be defined for endings type",
        });
      }
    }
  });

export type TSurveyFollowUpTrigger = z.infer<typeof ZSurveyFollowUpTrigger>;

export const ZSurveyFollowUpAction = z.object({
  type: z.literal("send-email"),
  properties: z.object({
    to: z.string(),
    from: z.string().email(),
    replyTo: z.array(z.string().email()),
    subject: z.string(),
    body: z.string(),
    attachResponseData: z.boolean().default(false),
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
