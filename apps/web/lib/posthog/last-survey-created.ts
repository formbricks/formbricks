import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export type TPostHogLastSurveyCreatedProperty = {
  // ISO 8601, or null when none of the person's organizations have created a survey yet. Not scoped
  // to "the organization I'm currently looking at" or "surveys I personally created" — a person can
  // belong to several organizations, and a teammate creating a survey in any of them should still
  // move this forward, since PostHog person properties are a single flat value per key rather than
  // something scoped per organization/relationship.
  last_survey_created_at: string | null;
};

/**
 * The most recent survey creation timestamp across every organization this person is a member of.
 * Recomputed from the database on every call rather than patched at the moment of creation, so it
 * self-heals regardless of who created the survey or which organization/workspace they were in —
 * the same reasoning as the multi-org role snapshot in lib/posthog/organization-roles.ts.
 */
export const getLastSurveyCreatedAtPersonProperty = async (
  userId: string
): Promise<TPostHogLastSurveyCreatedProperty> => {
  validateInputs([userId, ZString]);

  try {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });

    if (memberships.length === 0) {
      return { last_survey_created_at: null };
    }

    const latestSurvey = await prisma.survey.findFirst({
      where: {
        workspace: {
          organizationId: { in: memberships.map((membership) => membership.organizationId) },
        },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return { last_survey_created_at: latestSurvey?.createdAt.toISOString() ?? null };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error getting last survey created at for PostHog person property");
      throw new DatabaseError(error.message);
    }

    throw new UnknownError("Error while fetching last survey created at");
  }
};
