import { ActivityEventType, ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import {
  TEngagementCompletedMetadata,
  TEngagementCreatedMetadata,
  TMemberJoinedMetadata,
  TMemberLeftMetadata,
  TRewardPaidMetadata,
} from "@formbricks/types/activity";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";

export const addMemberJoinedActivity = async ({
  subjectId,
  metadata,
}: {
  subjectId: string;
  metadata: TMemberJoinedMetadata;
}): Promise<string> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });

    // Check if user exists
    if (!user) {
      throw new InvalidInputError("User/Community does not exist!");
    }

    // Create new activity
    const activity = await prisma.activity.create({
      data: {
        subjectId: subjectId,
        activityEvent: ActivityEventType.MEMBER_JOINED,
        activityType: ActivityType.USER,
        metadata: metadata,
      },
    });

    return activity.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const addMemberLeftActivity = async ({
  subjectId,
  metadata,
}: {
  subjectId: string;
  metadata: TMemberLeftMetadata;
}): Promise<string> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });

    // Check if user exists
    if (!user) {
      throw new InvalidInputError("User/Community does not exist!");
    }

    // Create new activity
    const activity = await prisma.activity.create({
      data: {
        subjectId: subjectId,
        activityEvent: ActivityEventType.MEMBER_LEFT,
        activityType: ActivityType.USER,
        metadata: metadata,
      },
    });

    return activity.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const addEngagementCompletedActivity = async ({
  subjectId,
  metadata,
}: {
  subjectId: string;
  metadata: TEngagementCompletedMetadata;
}): Promise<string> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });

    // Check if user exists
    if (!user) {
      throw new InvalidInputError("User/Community does not exist!");
    }

    // Create new activity
    const activity = await prisma.activity.create({
      data: {
        subjectId: subjectId,
        activityEvent: ActivityEventType.ENGAGEMENT_COMPLETED,
        activityType: ActivityType.USER,
        metadata: metadata,
      },
    });

    return activity.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const addEngagementCreatedActivity = async ({
  subjectId,
  metadata,
}: {
  subjectId: string;
  metadata: TEngagementCreatedMetadata;
}): Promise<string> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });

    // Check if user exists
    if (!user) {
      throw new InvalidInputError("User/Community does not exist!");
    }

    // Create new activity
    const activity = await prisma.activity.create({
      data: {
        subjectId: subjectId,
        activityEvent: ActivityEventType.ENGAGEMENT_CREATED,
        activityType: ActivityType.COMMUNITY,
        metadata: metadata,
      },
    });

    return activity.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const addRewardPaidActivity = async ({
  subjectId,
  metadata,
}: {
  subjectId: string;
  metadata: TRewardPaidMetadata;
}): Promise<string> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });

    // Check if user exists
    if (!user) {
      throw new InvalidInputError("User/Community does not exist!");
    }

    // Create new activity
    const activity = await prisma.activity.create({
      data: {
        subjectId: subjectId,
        activityEvent: ActivityEventType.REWARD_PAID,
        activityType: ActivityType.USER,
        metadata: metadata,
      },
    });

    return activity.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
