import { prisma } from "@formbricks/database";
import { TBaseFilterGroup, TUserSegmentUpdateInput } from "@formbricks/types/v1/userSegment";

export const createUserSegment = async (
  environmentId: string,
  surveyId: string,
  title: string,
  description: string,
  isPrivate: boolean,
  filters: TBaseFilterGroup
) => {
  const userSegment = await prisma.userSegment.create({
    data: {
      environmentId,
      title,
      description,
      isPrivate,
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

export const getAllUserSegment = async (environmentId: string) => {
  const userSegments = await prisma.userSegment.findMany({
    where: {
      environmentId,
    },
  });

  return userSegments;
};

export const updateUserSegment = async (segmentId: string, data: TUserSegmentUpdateInput) => {
  const userSegment = await prisma.userSegment.update({
    where: {
      id: segmentId,
    },
    data,
  });

  return userSegment;
};
