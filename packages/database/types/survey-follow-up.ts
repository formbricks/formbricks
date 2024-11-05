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
    to: z.array(z.string().email()),
    from: z.string().email(),
    replyTo: z.array(z.string().email()),
    subject: z.string(),
    body: z.string(),
  }),
});

export type TSurveyFollowUpAction = z.infer<typeof ZSurveyFollowUpAction>;
