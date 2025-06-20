"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import {
  addEngagementCompletedActivity,
  addEngagementCreatedActivity,
  addMemberJoinedActivity,
  addMemberLeftActivity,
  addRewardPaidActivity,
} from "@/modules/activity/lib/activity";
import { z } from "zod";

const ZAddMemberJoinedActivityAction = z.object({
  communityId: z.string(),
});

export const addMemberJoinedActivityAction = authenticatedActionClient
  .schema(ZAddMemberJoinedActivityAction)
  .action(async ({ parsedInput, ctx }) => {
    const activityId = await addMemberJoinedActivity({
      subjectId: ctx.user.id,
      metadata: {
        communityId: parsedInput.communityId,
      },
    });

    return activityId;
  });

const ZAddMemberLeftActivityAction = z.object({
  communityId: z.string(),
});

export const addMemberLeftActivityAction = authenticatedActionClient
  .schema(ZAddMemberLeftActivityAction)
  .action(async ({ parsedInput, ctx }) => {
    const activityId = await addMemberLeftActivity({
      subjectId: ctx.user.id,
      metadata: {
        communityId: parsedInput.communityId,
      },
    });

    return activityId;
  });

const ZAddEngagementCompletedActivityAction = z.object({
  communityId: z.string(),
  engagementId: z.string(),
});

export const addEngagementCompletedActivityAction = authenticatedActionClient
  .schema(ZAddEngagementCompletedActivityAction)
  .action(async ({ parsedInput, ctx }) => {
    const activityId = await addEngagementCompletedActivity({
      subjectId: ctx.user.id,
      metadata: {
        communityId: parsedInput.communityId,
        engagementId: parsedInput.engagementId,
      },
    });

    return activityId;
  });

const ZAddEngagementCreatedActivityAction = z.object({
  engagementId: z.string(),
  title: z.string(),
  reward: z.any(),
});

export const addEngagementCreatedActivityAction = authenticatedActionClient
  .schema(ZAddEngagementCreatedActivityAction)
  .action(async ({ parsedInput, ctx }) => {
    const activityId = await addEngagementCreatedActivity({
      subjectId: ctx.user.id,
      metadata: {
        engagementId: parsedInput.engagementId,
        title: parsedInput.title,
        reward: parsedInput.reward,
      },
    });

    return activityId;
  });

const ZAddRewardPaidActivityAction = z.object({
  engagementId: z.string(),
  reward: z.any(),
});

export const addRewardPaidActivityAction = authenticatedActionClient
  .schema(ZAddRewardPaidActivityAction)
  .action(async ({ parsedInput, ctx }) => {
    const activityId = await addRewardPaidActivity({
      subjectId: ctx.user.id,
      metadata: {
        engagementId: parsedInput.engagementId,
        reward: parsedInput.reward,
      },
    });

    return activityId;
  });
