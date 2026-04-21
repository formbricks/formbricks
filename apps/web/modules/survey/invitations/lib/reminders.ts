import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TSurveyInvitationConfig } from "@formbricks/types/surveys/types";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { sendSurveyInvitationEmail } from "@/modules/email";
import { renderSubject, renderTemplate } from "./template";

// Sends a reminder to every invitation for `surveyId` where:
//  - the email was sent (sentAt is set)
//  - the recipient has not responded
//  - either no reminder yet OR last reminder was older than minDaysSinceLast days ago
export async function sendManualReminders(args: {
  surveyId: string;
  organizationName: string;
  surveyName: string;
  config: TSurveyInvitationConfig;
  minDaysSinceLast?: number;
}): Promise<{ sent: number; skipped: number; failed: number }> {
  const { surveyId, organizationName, surveyName, config, minDaysSinceLast = 0 } = args;

  const cutoff = new Date(Date.now() - minDaysSinceLast * 86400_000);

  const targets = await prisma.surveyInvitation.findMany({
    where: {
      surveyId,
      sentAt: { not: null },
      respondedAt: null,
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: cutoff } }],
    },
    select: {
      id: true,
      recipientEmail: true,
      recipientName: true,
      contactId: true,
      linkToken: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const inv of targets) {
    try {
      // Refresh the link in case tokens rotate; fall back to the stored
      // linkToken if refresh fails. Stale tokens can send broken links if
      // WEBAPP_URL changed or ENCRYPTION_KEY rotated, so we log the fallback.
      let surveyLink = inv.linkToken;
      if (inv.contactId) {
        const fresh = await getContactSurveyLink(inv.contactId, surveyId);
        if (fresh.ok) {
          surveyLink = fresh.data;
        } else {
          logger.warn(
            { invitationId: inv.id, surveyId, error: fresh.error.type },
            "getContactSurveyLink failed during manual reminder; using stored linkToken (may be stale)"
          );
        }
      }

      const vars = {
        recipientName: inv.recipientName ?? "",
        recipientEmail: inv.recipientEmail,
        surveyName,
        surveyLink,
        organizationName,
      };
      const subject = renderSubject(config.emailTemplates.reminder.subject, vars);
      const body = renderTemplate(config.emailTemplates.reminder.body, vars);

      await sendSurveyInvitationEmail({
        to: inv.recipientEmail,
        subject,
        body,
        surveyLink,
      });

      await prisma.surveyInvitation.update({
        where: { id: inv.id },
        data: {
          lastReminderAt: new Date(),
          reminderCount: { increment: 1 },
          linkToken: surveyLink,
        },
      });
      sent++;
    } catch (error) {
      logger.error({ error, invitationId: inv.id, surveyId }, "Reminder send failed");
      failed++;
    }
  }

  skipped = 0; // currently no skip path for manual reminders
  return { sent, skipped, failed };
}
