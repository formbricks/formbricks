import { prisma } from "@formbricks/database";
import { TBaseFilterGroup } from "@formbricks/types/v1/userSegment";

export const createUserSegment = async (
  environmentId: string,
  surveyId: string,
  title: string,
  description: string,
  filters: TBaseFilterGroup
) => {
  const userSegment = await prisma.userSegment.create({
    data: {
      environmentId,
      title,
      description,
      filters,
      surveys: {
        connect: {
          id: surveyId,
        },
      },
    },
  });

  return userSegment;
};
