import "server-only";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import type { TResponseMeta } from "@formbricks/types/responses";

/**
 * Opened by creative: which creative opened a survey, as recorded on its display and
 * response. A client names the creative by id — the renderer for a creative's click, the link page for
 * `?creativeId=` — and nothing it says is trusted: the creative counts only when it is in the survey's
 * workspace and its Destination is that survey. Its status does not matter, so a response finished
 * after the creative was paused or archived still records it.
 *
 * Anything else — no id, a malformed one, an unknown creative, another workspace's, one that opens a
 * different survey — is no attribution, never an error: a display or response must not fail over it.
 */

export type TCreativeAttribution = Readonly<{ id: string; name: string }>;

type TOpenedSurvey = Readonly<{ creativeId: unknown; workspaceId: string; surveyId: string }>;

export const getCreativeAttribution = async ({
  creativeId,
  workspaceId,
  surveyId,
}: TOpenedSurvey): Promise<TCreativeAttribution | null> => {
  const id = ZId.safeParse(creativeId);
  if (!id.success) return null;

  return prisma.creative.findFirst({
    where: { id: id.data, workspaceId, surveyId },
    select: { id: true, name: true },
  });
};

/** The response meta the ingest routes stamp: both keys when the creative checks out, else none. */
export const getOpenedByCreativeMeta = async (
  opened: TOpenedSurvey
): Promise<Pick<TResponseMeta, "openedByCreativeId" | "openedByCreativeName">> => {
  const attribution = await getCreativeAttribution(opened);
  return attribution ? { openedByCreativeId: attribution.id, openedByCreativeName: attribution.name } : {};
};
