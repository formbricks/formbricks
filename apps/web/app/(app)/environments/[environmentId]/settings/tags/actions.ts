"use server";

import { deleteTag, mergeTags, updateTagName } from "@formbricks/lib/tag/service";
import { canUserAccessTagCached } from "@formbricks/lib/tag/auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";

export const deleteTagAction = async (tagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await canUserAccessTagCached(session.user.id, tagId);

  if (isAuthorized) {
    return await deleteTag(tagId);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
};

export const updateTagNameAction = async (tagId: string, name: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await canUserAccessTagCached(session.user.id, tagId);

  if (isAuthorized) {
    return await updateTagName(tagId, name);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
};

export const mergeTagsAction = async (originalTagId: string, newTagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorizedForOld = await canUserAccessTagCached(session.user.id, originalTagId);
  const isAuthorizedForNew = await canUserAccessTagCached(session.user.id, newTagId);

  if (isAuthorizedForOld && isAuthorizedForNew) {
    return await mergeTags(originalTagId, newTagId);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
};
