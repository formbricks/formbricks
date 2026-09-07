import type { TTag } from "@formbricks/types/tags";

export type TV3Tag = {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  /** Responses currently carrying this tag. Zero when the tag has never been applied. */
  count: number;
};

export const serializeV3Tag = (tag: TTag, count: number): TV3Tag => ({
  id: tag.id,
  name: tag.name,
  workspaceId: tag.workspaceId,
  createdAt: tag.createdAt.toISOString(),
  updatedAt: tag.updatedAt.toISOString(),
  count,
});
