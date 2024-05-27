import { prisma } from "@formbricks/database";

export const getTeamIds = async (): Promise<string[]> => {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
    },
  });
  return teams.map((team) => team.id);
};
