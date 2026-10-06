import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@formbricks/database";
import type { TResponseData } from "@formbricks/types/responses";
import type { TSurveyType } from "@formbricks/types/surveys/types";

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
 * A candidate the new submission can be folded into: both finished, with the same answers.
 *
 * Both sides have to be finished. An unfinished submission handed a finished response's id would
 * make the renderer's next update fail with "Response is already finished". An unfinished candidate
 * is worse: `userId` / `contactId` are client-asserted and the client PUT needs only the response
 * id, so returning it would let anyone who repeats a contact's identity and answers overwrite or
 * finish that contact's in-progress response — and a finished submission folded into it would
 * never mark it finished or fire `responseFinished`. A finished response can no longer be updated.
 */
export const isDuplicateOfCandidate = (
  candidate: TDuplicateCandidate,
  submission: { data: TResponseData; finished: boolean }
): boolean => {
  if (!candidate.finished || !submission.finished) return false;
  return isDeepStrictEqual(candidate.data, submission.data);
};

/**
 * Only finished submissions to link surveys can fold. An app survey on "keep showing" can
 * legitimately collect the same answer from the same contact twice in a minute (e.g. on two pages).
 * Exported so a caller can skip resolving the contact when the submission can't fold anyway.
 */
export const canFoldSubmission = ({ surveyType, finished }: { surveyType: TSurveyType; finished: boolean }) =>
  surveyType === "link" && finished;

/**
 * Finds a response the same contact just submitted to the same survey with identical answers, so
 * the caller can hand back its id instead of creating a second row. Only identified submissions are
 * checked: without a contact there is no way to tell two recipients of the same prefilled link apart.
 */
export const findRecentDuplicateResponse = async ({
  surveyId,
  surveyType,
  contactId,
  data,
  finished,
  now = new Date(),
}: {
  surveyId: string;
  surveyType: TSurveyType;
  contactId: string | null | undefined;
  data: TResponseData;
  finished: boolean;
  now?: Date;
}): Promise<{ id: string } | null> => {
  if (!contactId || !canFoldSubmission({ surveyType, finished })) return null;

  // Served by the (contactId, createdAt) index; bounded because a contact has a handful of
  // responses in any one minute. Unfinished rows are filtered here, not only in the predicate, so
  // they can't use up `take`. A response a full quota screened out is skipped too: the caller
  // answers a fold with `quotaFull: false`, which is only the original's outcome when it was not.
  const candidates = await prisma.response.findMany({
    where: {
      surveyId,
      contactId,
      finished: true,
      createdAt: { gte: new Date(now.getTime() - DUPLICATE_RESPONSE_WINDOW_MS) },
      quotaLinks: { none: { status: "screenedOut" } },
    },
    select: { id: true, data: true, finished: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const duplicate = candidates.find((candidate) => isDuplicateOfCandidate(candidate, { data, finished }));
  return duplicate ? { id: duplicate.id } : null;
};
