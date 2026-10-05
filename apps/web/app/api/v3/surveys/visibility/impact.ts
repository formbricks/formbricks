import "server-only";
import { prisma } from "@formbricks/database";

export type TSurveyVisibilityImpact = Readonly<{ memberCount: number; responseCount: number }>;

/**
 * The numbers the confirmation dialogues show (contract §3): the people other than the owner and the
 * organization's owners and managers who can see the survey through the workspace — who would lose
 * access by restricting it, or gain it by sharing it — and the survey's responses.
 *
 * Membership through a team only counts for a non-billing member of the organization, mirroring the
 * graph's `team#member` intersection with `organization#product_member`.
 */
export const getSurveyVisibilityImpact = async (
  survey: Readonly<{ id: string; ownerId: string | null; workspaceId: string }>,
  organizationId: string
): Promise<TSurveyVisibilityImpact> => {
  const [memberCount, responseCount] = await Promise.all([
    prisma.user.count({
      where: {
        ...(survey.ownerId ? { id: { not: survey.ownerId } } : {}),
        teamUsers: { some: { team: { workspaceTeams: { some: { workspaceId: survey.workspaceId } } } } },
        isActive: true,
        memberships: { some: { organizationId, role: "member" } },
      },
    }),
    prisma.response.count({ where: { surveyId: survey.id } }),
  ]);

  return { memberCount, responseCount };
};
