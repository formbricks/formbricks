import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZSurveyInvitationConfig } from "@formbricks/types/surveys/types";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { sendSurveyInvitationEmail } from "@/modules/email";
import { renderSubject, renderTemplate } from "./template";

// Iterates every survey that has an enabled reminder schedule and sends any
// reminders that are now eligible. Idempotent: each (invitation, offset day) is
// tracked in sentOffsetDays so re-running does not double-send. Designed to be
// called by an external cron roughly once a day.
export async function runScheduledReminders(): Promise<{
  surveysProcessed: number;
  sent: number;
  failed: number;
}> {
  const now = new Date();
  let surveysProcessed = 0;
  let sent = 0;
  let failed = 0;

  // We can't filter by JSON fields robustly across DB backends; pull all surveys
  // with an invitationConfig and check client-side. Expected to be a small set.
  const candidateSurveys = await prisma.survey.findMany({
    where: { invitationConfig: { not: null as any }, status: "inProgress" },
    select: {
      id: true,
      name: true,
      environmentId: true,
      invitationConfig: true,
    },
  });

  for (const survey of candidateSurveys) {
    const parsed = ZSurveyInvitationConfig.safeParse(survey.invitationConfig);
    if (!parsed.success) continue;
    const config = parsed.data;
    if (!config.reminderSchedule.enabled) continue;
    if (config.reminderSchedule.daysAfterInvite.length === 0) continue;

    surveysProcessed++;
    const org = await getOrganizationByEnvironmentId(survey.environmentId);
    const organizationName = org?.name ?? "";

    for (const offsetDays of config.reminderSchedule.daysAfterInvite) {
      const sentBefore = new Date(now.getTime() - offsetDays * 86400_000);

      const targets = await prisma.surveyInvitation.findMany({
        where: {
          surveyId: survey.id,
          sentAt: { not: null, lte: sentBefore },
          respondedAt: null,
          reminderCount: { lt: config.reminderSchedule.maxReminders },
          NOT: { sentOffsetDays: { has: offsetDays } },
        },
        select: {
          id: true,
          recipientEmail: true,
          recipientName: true,
          contactId: true,
          linkToken: true,
          sentOffsetDays: true,
        },
      });

      for (const inv of targets) {
        try {
          // Atomic pre-claim via Postgres array ops. The raw SQL ensures only
          // one concurrent worker (cron running twice, manual trigger racing,
          // etc.) can attach this offset to this invitation. Workers that lose
          // the race get claimedCount === 0 and skip the send. This replaces
          // a check-then-act that could double-send when runs overlap.
          const claimedRows = await prisma.$executeRaw<number>`
            UPDATE "SurveyInvitation"
            SET "sentOffsetDays" = "sentOffsetDays" || ${offsetDays}::int,
                "reminderCount" = "reminderCount" + 1,
                "lastReminderAt" = NOW(),
                "updated_at" = NOW()
            WHERE id = ${inv.id}
              AND NOT (${offsetDays}::int = ANY("sentOffsetDays"))
              AND "respondedAt" IS NULL
              AND "reminderCount" < ${config.reminderSchedule.maxReminders}
          `;
          if (claimedRows === 0) continue;

          let surveyLink = inv.linkToken;
          if (inv.contactId) {
            const fresh = await getContactSurveyLink(inv.contactId, survey.id);
            if (fresh.ok) {
              surveyLink = fresh.data;
              // Best-effort link refresh — non-fatal if the update fails.
              await prisma.surveyInvitation
                .update({ where: { id: inv.id }, data: { linkToken: surveyLink } })
                .catch((e) => logger.warn({ e, invitationId: inv.id }, "linkToken refresh failed"));
            } else {
              logger.warn(
                { invitationId: inv.id, surveyId: survey.id, error: fresh.error.type },
                "getContactSurveyLink failed during scheduled reminder; using stored link"
              );
            }
          }

          const vars = {
            recipientName: inv.recipientName ?? "",
            recipientEmail: inv.recipientEmail,
            surveyName: survey.name,
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
          sent++;
        } catch (error) {
          logger.error(
            { error, invitationId: inv.id, surveyId: survey.id, offsetDays },
            "Scheduled reminder send failed (claim held — will NOT retry this offset)"
          );
          failed++;
        }
      }
    }
  }

  return { surveysProcessed, sent, failed };
}
