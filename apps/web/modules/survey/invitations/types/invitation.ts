import { z } from "zod";

// Serializable shape returned from server actions to UI — Dates as ISO strings.
export const ZInvitationRow = z.object({
  id: z.string().cuid2(),
  recipientEmail: z.string().email(),
  recipientName: z.string().nullable(),
  contactId: z.string().cuid2().nullable(),
  sentAt: z.string().nullable(),
  respondedAt: z.string().nullable(),
  lastReminderAt: z.string().nullable(),
  reminderCount: z.number().int(),
});

export type TInvitationRow = z.infer<typeof ZInvitationRow>;

export const ZInvitationSummary = z.object({
  total: z.number().int(),
  sent: z.number().int(),
  pending: z.number().int(),
  responded: z.number().int(),
});

export type TInvitationSummary = z.infer<typeof ZInvitationSummary>;

export const MERGE_FIELDS = [
  "recipientName",
  "recipientEmail",
  "surveyName",
  "surveyLink",
  "organizationName",
] as const;

export type TMergeField = (typeof MERGE_FIELDS)[number];

export const DEFAULT_INVITATION_SUBJECT = "You’re invited to take our survey";
export const DEFAULT_INVITATION_BODY = `Hi {{recipientName}},

We’d like your input on our latest survey: {{surveyName}}.

It should take just a few minutes. Thank you!`;

export const DEFAULT_REMINDER_SUBJECT = "Reminder: please take our survey";
export const DEFAULT_REMINDER_BODY = `Hi {{recipientName}},

Just a friendly reminder to complete our survey: {{surveyName}}.

Your feedback matters. Thank you!`;
