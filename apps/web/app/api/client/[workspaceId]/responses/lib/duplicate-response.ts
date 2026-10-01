import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@formbricks/database";
import type { TResponseData } from "@formbricks/types/responses";

/**
 * How far back a new response is compared against the contact's earlier ones (ENG-1147).
 *
 * Mail security scanners (Safe Links, URL Defense and the like) check a link at the moment the
 * recipient clicks it: they open it in a headless browser, which runs the survey and — with
 * `skipPrefilled` — auto-submits the prefilled answer, and only then forward the recipient, who
 * submits the same answer again a few seconds later. A minute covers that hand-off without
 * swallowing a genuine second response, which arrives after the first one's ending, not seconds
 * into it.
 */
export const DUPLICATE_RESPONSE_WINDOW_MS = 60_000;

type TDuplicateCandidate = { id: string; data: unknown; finished: boolean };

/**
 * A candidate the new submission can be folded into: same answers, and still able to take whatever
 * the new submission goes on to send. Returning a finished response to a submission that is not
 * finished would make the renderer's next update fail with "Response is already finished".
 */
export const isDuplicateOfCandidate = (
  candidate: TDuplicateCandidate,
  submission: { data: TResponseData; finished: boolean }
): boolean => {
  if (candidate.finished && !submission.finished) return false;
  return isDeepStrictEqual(candidate.data, submission.data);
};

/**
 * Finds a response the same contact just submitted to the same survey with identical answers, so
 * the caller can hand back its id instead of creating a second row. Only identified submissions are
 * checked: without a contact there is no way to tell two recipients of the same prefilled link apart.
 */
export const findRecentDuplicateResponse = async ({
  surveyId,
  contactId,
  data,
  finished,
  now = new Date(),
}: {
  surveyId: string;
  contactId: string | null | undefined;
  data: TResponseData;
  finished: boolean;
  now?: Date;
}): Promise<{ id: string } | null> => {
  if (!contactId) return null;

  // Served by the (contactId, createdAt) index; bounded because a contact has a handful of
  // responses in any one minute.
  const candidates = await prisma.response.findMany({
    where: {
      surveyId,
      contactId,
      createdAt: { gte: new Date(now.getTime() - DUPLICATE_RESPONSE_WINDOW_MS) },
    },
    select: { id: true, data: true, finished: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const duplicate = candidates.find((candidate) => isDuplicateOfCandidate(candidate, { data, finished }));
  return duplicate ? { id: duplicate.id } : null;
};
