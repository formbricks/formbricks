"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import {
  addUserCommunity,
  getAvailableUserCommunities,
  getCurrentUserCommunities,
  removeUserCommunity,
} from "@/modules/communities/lib/communities";
import { z } from "zod";

//getUserCommunities,

const ZAddUserCommunityAction = z.object({
  creatorId: z.string(),
});

export const addUserCommunityAction = authenticatedActionClient
  .schema(ZAddUserCommunityAction)
  .action(async ({ parsedInput, ctx }) => {
    const userCommunityId = await addUserCommunity({
      userId: ctx.user.id,
      creatorId: parsedInput.creatorId,
    });

    return userCommunityId;
  });

const ZRemoveUserCommunityAction = z.object({
  creatorId: z.string(),
});

export const removeUserCommunityAction = authenticatedActionClient
  .schema(ZRemoveUserCommunityAction)
  .action(async ({ parsedInput, ctx }) => {
    const deletedUserCommunityId = await removeUserCommunity({
      userId: ctx.user.id,
      creatorId: parsedInput.creatorId,
    });

    return deletedUserCommunityId;
  });

// Todo: Add pagination
const ZGetAvailableUserCommunitiesAction = z.object({
  query: z.string().optional(),
});

export const getAvailableUserCommunitiesAction = authenticatedActionClient
  .schema(ZGetAvailableUserCommunitiesAction)
  .action(async ({ parsedInput, ctx }) => {
    return await getAvailableUserCommunities({
      userId: ctx.user.id,
      query: parsedInput.query,
    });
  });

const ZGetCurrentUserCommunitiesAction = z.object({
  query: z.string().optional(),
});

export const getCurrentUserCommunitiesAction = authenticatedActionClient
  .schema(ZGetCurrentUserCommunitiesAction)
  .action(async ({ parsedInput, ctx }) => {
    return await getCurrentUserCommunities({
      userId: ctx.user.id,
      query: parsedInput.query,
    });
  });

// const ZGetUserCommunitiesAction = z.object({
//   take: z.number(),
//   skip: z.number(),
//   query: z.string().optional(),
// });

// export const getUserCommunitiesAction = authenticatedActionClient
//   .schema(ZGetUserCommunitiesAction)
//   .action(async ({ parsedInput, ctx }) => {
//     const userCommunities = await getUserCommunities({
//       userId: ctx.user.id,
//       query: parsedInput.query
//     });

//     return userCommunities;
//   });
