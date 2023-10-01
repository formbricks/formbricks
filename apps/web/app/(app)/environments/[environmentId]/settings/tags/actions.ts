"use server";

import { deleteTag, mergeTags, updateTagName } from "@formbricks/lib/services/tag";

export const deleteTagAction = async (tagId: string) => {
  return await deleteTag(tagId);
};

export const updateTagNameAction = async (tagId: string, name: string) => {
  return await updateTagName(tagId, name);
};

export const mergeTagsAction = async (originalTagId: string, newTagId: string) => {
  return await mergeTags(originalTagId, newTagId);
};
