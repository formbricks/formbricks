import type { TResponseWithQuotas } from "@formbricks/types/responses";
import type { TTag } from "@formbricks/types/tags";

type TJsonTag = Omit<TTag, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

/**
 * A response as the response card renders it: its answers, metadata, tags, screened-in quotas and what the
 * respondent was not shown. Timestamps travel as ISO strings; the card's API client revives them.
 */
export type TResponseCardResource = Omit<TResponseWithQuotas, "createdAt" | "updatedAt" | "tags"> & {
  createdAt: string;
  updatedAt: string;
  tags: TJsonTag[];
};

const serializeTag = (tag: TTag): TJsonTag => ({
  id: tag.id,
  name: tag.name,
  workspaceId: tag.workspaceId,
  createdAt: tag.createdAt.toISOString(),
  updatedAt: tag.updatedAt.toISOString(),
});

export const serializeResponseCard = (response: TResponseWithQuotas): TResponseCardResource => ({
  id: response.id,
  createdAt: response.createdAt.toISOString(),
  updatedAt: response.updatedAt.toISOString(),
  surveyId: response.surveyId,
  displayId: response.displayId,
  contact: response.contact,
  contactAttributes: response.contactAttributes,
  finished: response.finished,
  endingId: response.endingId,
  data: response.data,
  variables: response.variables,
  ttc: response.ttc,
  tags: response.tags.map(serializeTag),
  meta: response.meta,
  singleUseId: response.singleUseId,
  language: response.language,
  outcome: response.outcome,
  quotas: response.quotas?.map((quota) => ({ id: quota.id, name: quota.name })),
  notShown: response.notShown,
});

/** A tag on a response. */
export type TResponseTagResource = { responseId: string; tagId: string };
