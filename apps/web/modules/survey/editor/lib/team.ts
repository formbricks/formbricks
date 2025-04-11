import { teamCache } from "@/lib/cache/team";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";

export const getTeamMemberEmails = reactCache(async (teamIds: string[]): Promise<string[]> => {
  const cacheTags = teamIds.map((teamId) => teamCache.tag.byId(teamId));

  return cache(
    async () => {
      if (teamIds.length === 0) {
        return [];
      }

      const emails: string[] = [];

      for (const teamId of teamIds) {
        const teamMembers = await prisma.teamUser.findMany({
          where: {
            teamId,
          },
        });

        const userEmails = await prisma.user.findMany({
          where: {
            id: {
              in: teamMembers.map((member) => member.userId),
            },
          },
          select: {
            email: true,
          },
        });

        const uniqueEmails = userEmails.map((user) => user.email);

        emails.push(...uniqueEmails);
      }

      return Array.from(new Set(emails));
    },
    [`getTeamMemberEmails-${teamIds.join(",")}`],
    {
      tags: [...cacheTags],
    }
  )();
});
