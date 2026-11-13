import type { TTag } from "@formbricks/types/tags";

/** A workspace tag, as the response card's tag picker adds it. */
export type TTagResource = {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
};

export const serializeTag = (tag: TTag): TTagResource => ({
  id: tag.id,
  name: tag.name,
  workspaceId: tag.workspaceId,
  createdAt: tag.createdAt.toISOString(),
  updatedAt: tag.updatedAt.toISOString(),
});
