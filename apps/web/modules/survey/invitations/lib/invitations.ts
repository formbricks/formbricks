import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TSurveyInvitationConfig } from "@formbricks/types/surveys/types";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { sendSurveyInvitationEmail } from "@/modules/email";
import type { TInvitationSummary } from "../types/invitation";
import { type TAudienceMember, resolveAudience } from "./audience";
import { renderSubject, renderTemplate } from "./template";

const DEFAULT_ATTRIBUTE_KEYS = ["email", "firstName", "lastName"] as const;

// Find-or-create a Contact row keyed on (environmentId, email). Schema has no
// DB-level unique on email-per-environment, so we guard concurrent callers by:
//  (a) trying a find first (happy path for existing contacts),
//  (b) attempting create and catching the unique-violation on ContactAttribute
//      which fires if another writer inserted the same email-attribute row,
//  (c) re-fetching on conflict.
// This avoids duplicate Contact rows when two sends race (e.g. a manual "Send
// invitations" click and a scheduled reminder firing simultaneously).
async function ensureContact(environmentId: string, email: string, name: string | null): Promise<string> {
  const findExisting = () =>
    prisma.contact.findFirst({
      where: {
        environmentId,
        attributes: { some: { attributeKey: { key: "email" }, value: email } },
      },
      select: { id: true },
    });

  const existing = await findExisting();
  if (existing) return existing.id;

  const keys = await prisma.contactAttributeKey.findMany({
    where: { environmentId, key: { in: [...DEFAULT_ATTRIBUTE_KEYS] } },
    select: { id: true, key: true },
  });
  const keyByName = new Map(keys.map((k) => [k.key, k.id]));

  const [firstName, ...rest] = (name ?? "").split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ") || null;

  const createAttributes: { attributeKeyId: string; value: string }[] = [];
  const emailKeyId = keyByName.get("email");
  if (emailKeyId) createAttributes.push({ attributeKeyId: emailKeyId, value: email });
  const firstNameKeyId = keyByName.get("firstName");
  if (firstNameKeyId && firstName)
    createAttributes.push({ attributeKeyId: firstNameKeyId, value: firstName });
  const lastNameKeyId = keyByName.get("lastName");
  if (lastNameKeyId && lastName) createAttributes.push({ attributeKeyId: lastNameKeyId, value: lastName });

  try {
    const created = await prisma.contact.create({
      data: { environmentId, attributes: { create: createAttributes } },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    // P2002 = unique constraint violation. Another concurrent writer likely
    // created the contact between our find and our create; re-query and use theirs.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const retry = await findExisting();
      if (retry) return retry.id;
    }
    throw error;
  }
}

// Find-or-create SurveyInvitation row. Idempotent on (surveyId, recipientEmail).
// Token generation is skipped for already-sent invitations to avoid N extra
// survey fetches per audience member on re-runs. Callers that specifically need
// a fresh token (e.g. reminder sends) pass `refreshToken: true`.
export async function upsertInvitation(args: {
  surveyId: string;
  member: TAudienceMember;
  environmentId: string;
  refreshToken?: boolean;
}): Promise<{ id: string; contactId: string | null; linkToken: string; created: boolean }> {
  const { surveyId, member, environmentId, refreshToken = false } = args;

  // Check idempotency first. For an already-sent invitation we can return the
  // stored token (or regenerate only if the caller explicitly asked to refresh),
  // avoiding the ~3 DB queries that a token regeneration requires.
  const existing = await prisma.surveyInvitation.findUnique({
    where: { surveyId_recipientEmail: { surveyId, recipientEmail: member.email } },
    select: { id: true, contactId: true, linkToken: true, sentAt: true },
  });

  if (existing && existing.sentAt && !refreshToken) {
    // Happy path on re-run: already sent, no need to rotate token or touch Contact.
    return {
      id: existing.id,
      contactId: existing.contactId,
      linkToken: existing.linkToken,
      created: false,
    };
  }

  // Either creating fresh, resuming an un-sent invitation, or explicit refresh:
  // resolve Contact (create for Snowflake audiences) and generate a fresh link.
  const contactId =
    member.existingContactId ?? (await ensureContact(environmentId, member.email, member.name));

  const linkResult = await getContactSurveyLink(contactId, surveyId);
  if (!linkResult.ok) {
    throw new Error(`getContactSurveyLink failed: ${linkResult.error.type}`);
  }
  const linkToken = linkResult.data;

  if (existing) {
    await prisma.surveyInvitation.update({
      where: { id: existing.id },
      data: { linkToken, contactId, recipientName: member.name },
    });
    return { id: existing.id, contactId, linkToken, created: false };
  }

  const created = await prisma.surveyInvitation.create({
    data: {
      surveyId,
      contactId,
      recipientEmail: member.email,
      recipientName: member.name,
      linkToken,
    },
    select: { id: true },
  });
  return { id: created.id, contactId, linkToken, created: true };
}

// Resolves the configured audience, upserts invitations, and emails any rows
// that haven't been sent yet (sentAt is null).
export async function sendInvitationsForSurvey(args: {
  surveyId: string;
  environmentId: string;
  organizationName: string;
  surveyName: string;
  config: TSurveyInvitationConfig;
}): Promise<{ sent: number; skipped: number; failed: number }> {
  const { surveyId, environmentId, organizationName, surveyName, config } = args;

  const members = await resolveAudience(config.audience);
  if (members.length === 0) {
    logger.warn({ surveyId }, "No audience members resolved for invitation send");
    return { sent: 0, skipped: 0, failed: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const member of members) {
    try {
      // Pre-check: if an invitation already exists and has been sent or responded,
      // skip without even resolving a Contact — cheapest possible re-run path.
      const existing = await prisma.surveyInvitation.findUnique({
        where: { surveyId_recipientEmail: { surveyId, recipientEmail: member.email } },
        select: { sentAt: true, respondedAt: true },
      });
      if (existing?.sentAt || existing?.respondedAt) {
        skipped++;
        continue;
      }

      const { id: invitationId, linkToken } = await upsertInvitation({
        surveyId,
        member,
        environmentId,
      });

      const vars = {
        recipientName: member.name ?? "",
        recipientEmail: member.email,
        surveyName,
        surveyLink: linkToken,
        organizationName,
      };
      const subject = renderSubject(config.emailTemplates.invitation.subject, vars);
      const body = renderTemplate(config.emailTemplates.invitation.body, vars);

      await sendSurveyInvitationEmail({
        to: member.email,
        subject,
        body,
        surveyLink: linkToken,
      });

      await prisma.surveyInvitation.update({
        where: { id: invitationId },
        data: { sentAt: new Date() },
      });
      sent++;
    } catch (error) {
      logger.error({ error, email: member.email, surveyId }, "Invitation send failed");
      failed++;
    }
  }

  return { sent, skipped, failed };
}

// Called from the pipeline when a response finishes — marks the matching
// invitation (if any) as responded so reminders won't target the person again.
// Primary match is by contactId (set by the /c/<token> flow). If contactId is
// null but the survey has outstanding invitations, we attempt a best-effort
// fallback match by email taken from the verified-email response metadata.
// This covers the edge case where ENCRYPTION_KEY rotates between invitation
// send and response submission, invalidating the token and leaving contactId
// null on the response.
export async function linkResponseToInvitation(responseId: string): Promise<void> {
  const response = await prisma.response.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      surveyId: true,
      contactId: true,
      contactAttributes: true,
    },
  });
  if (!response) return;

  let invitation = response.contactId
    ? await prisma.surveyInvitation.findFirst({
        where: {
          surveyId: response.surveyId,
          contactId: response.contactId,
          respondedAt: null,
        },
        select: { id: true },
      })
    : null;

  // Fallback: if no contactId match, try matching by email from contactAttributes
  // (populated by the verify-email flow) or a `verifiedEmail` meta key. This is
  // best-effort — we only fall back when pending invitations actually exist for
  // this survey, to keep the lookup narrow.
  if (!invitation && !response.contactId) {
    const pendingCount = await prisma.surveyInvitation.count({
      where: { surveyId: response.surveyId, respondedAt: null, sentAt: { not: null } },
    });
    if (pendingCount === 0) return;

    const attrs = (response.contactAttributes ?? {}) as Record<string, unknown>;
    const rawEmail = attrs.email;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined;

    if (!email) {
      logger.warn(
        { responseId, surveyId: response.surveyId, pendingCount },
        "Response has no contactId and no identifying email — invitation linking skipped; reminders may continue to target this respondent"
      );
      return;
    }

    invitation = await prisma.surveyInvitation.findUnique({
      where: { surveyId_recipientEmail: { surveyId: response.surveyId, recipientEmail: email } },
      select: { id: true },
    });
  }

  if (!invitation) return;

  await prisma.surveyInvitation.update({
    where: { id: invitation.id },
    data: { respondedAt: new Date(), responseId: response.id },
  });
}

export async function getInvitationSummary(surveyId: string): Promise<TInvitationSummary> {
  // Compute `pending` with its own query rather than subtracting counts — a
  // response recorded before `sentAt` gets set (e.g. someone had a link from
  // a prior run) would otherwise drive the count negative.
  const [total, sent, responded, pending] = await Promise.all([
    prisma.surveyInvitation.count({ where: { surveyId } }),
    prisma.surveyInvitation.count({ where: { surveyId, sentAt: { not: null } } }),
    prisma.surveyInvitation.count({ where: { surveyId, respondedAt: { not: null } } }),
    prisma.surveyInvitation.count({
      where: { surveyId, sentAt: { not: null }, respondedAt: null },
    }),
  ]);
  return { total, sent, pending, responded };
}
