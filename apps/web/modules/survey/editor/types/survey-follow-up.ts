import { z } from "zod";

export const ZCreateSurveyFollowUpFormSchema = z.object({
  followUpName: z.string().trim().min(1, "Name is required"),
  triggerType: z.enum(["response", "endings"]),
  endingIds: z.array(z.string().cuid2()).nullable(),
  emailTo: z.string().trim().min(1, "To is required"),
  replyTo: z.array(z.string().email()).min(1, "Replies must have at least one email"),
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Body is required"),
  attachResponseData: z.boolean(),
});

export type TCreateSurveyFollowUpForm = z.infer<typeof ZCreateSurveyFollowUpFormSchema>;
