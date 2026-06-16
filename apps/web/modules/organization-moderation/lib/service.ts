import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { deleteOrganization, suspendOrganization, unsuspendOrganization } from "@/lib/organization/service";

export interface TModerationOrganizationSummary {
  surveyId: string;
  surveyName: string;
  surveyStatus: string;
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  isSuspended: boolean;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  /// Member emails so an operator can sanity-check before suspending/deleting.
  members: { email: string; role: string; name: string | null }[];
}

/**
 * Resolves a (public) survey id to the owning organization plus enough context for an
 * operator to review a report before acting. Throws ResourceNotFoundError when the
 * survey or its organization cannot be found.
 */
export const getOrganizationContextBySurveyId = async (
  surveyId: string
): Promise<TModerationOrganizationSummary> => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: {
        id: true,
        name: true,
        status: true,
        workspace: {
          select: {
            id: true,
            name: true,
            organization: {
              select: {
                id: true,
                name: true,
                suspendedAt: true,
                suspendedReason: true,
                memberships: {
                  select: {
                    role: true,
                    user: { select: { email: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const organization = survey.workspace.organization;
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    return {
      surveyId: survey.id,
      surveyName: survey.name,
      surveyStatus: survey.status,
      workspaceId: survey.workspace.id,
      workspaceName: survey.workspace.name,
      organizationId: organization.id,
      organizationName: organization.name,
      isSuspended: organization.suspendedAt !== null,
      suspendedAt: organization.suspendedAt,
      suspendedReason: organization.suspendedReason,
      members: organization.memberships.map((membership) => ({
        email: membership.user.email,
        role: membership.role,
        name: membership.user.name,
      })),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Suspends the organization owning the given survey. Reversible — takes all of the
 * organization's link surveys offline immediately. Returns the resolved summary.
 */
export const suspendOrganizationBySurveyId = async (
  surveyId: string,
  reason?: string
): Promise<TModerationOrganizationSummary> => {
  const summary = await getOrganizationContextBySurveyId(surveyId);
  await suspendOrganization(summary.organizationId, reason);
  logger.warn(
    { surveyId, organizationId: summary.organizationId, reason },
    "Organization suspended via moderation endpoint"
  );
  return { ...summary, isSuspended: true };
};

/**
 * Lifts suspension from the organization owning the given survey.
 */
export const unsuspendOrganizationBySurveyId = async (
  surveyId: string
): Promise<TModerationOrganizationSummary> => {
  const summary = await getOrganizationContextBySurveyId(surveyId);
  await unsuspendOrganization(summary.organizationId);
  logger.warn(
    { surveyId, organizationId: summary.organizationId },
    "Organization unsuspended via moderation endpoint"
  );
  return { ...summary, isSuspended: false };
};

/**
 * Permanently deletes the organization owning the given survey. Irreversible.
 *
 * Requires the caller to pass the resolved organization id as `confirmOrganizationId`.
 * This guards against a single survey id silently nuking the wrong org: the operator
 * must first resolve the org (e.g. via GET), eyeball it, then echo the id back. A
 * mismatch throws before any deletion happens.
 */
export const deleteOrganizationBySurveyId = async (
  surveyId: string,
  confirmOrganizationId: string
): Promise<TModerationOrganizationSummary> => {
  const summary = await getOrganizationContextBySurveyId(surveyId);

  if (summary.organizationId !== confirmOrganizationId) {
    throw new ConfirmationMismatchError(
      `confirmOrganizationId "${confirmOrganizationId}" does not match the organization "${summary.organizationId}" owning survey "${surveyId}"`
    );
  }

  await deleteOrganization(summary.organizationId);
  logger.warn(
    { surveyId, organizationId: summary.organizationId },
    "Organization deleted via moderation endpoint"
  );
  return summary;
};

export class ConfirmationMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmationMismatchError";
  }
}
