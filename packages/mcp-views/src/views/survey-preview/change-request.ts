/**
 * What "Ask for a change" posts into the chat as the person's own turn. A survey's name, a question's
 * headline and its answers are workspace data that a colleague or a respondent wrote, so none of them go
 * into the message: it carries fixed text, the two ids and the person's own words, and the agent reads the
 * rest through its tools. An id that is not shaped like one is left out instead of being quoted.
 */

/** Ids are cuids or the slug-like ids an author gives a question; never free text. */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

const isId = (value: string): boolean => ID_SHAPE.test(value);

export interface ChangeTarget {
  id: string;
  number: number;
}

/** The message, or `null` when there is nothing to send: no request, or a survey id that is not an id. */
export const buildChangeRequest = ({
  surveyId,
  target,
  request,
}: {
  surveyId: string;
  target: ChangeTarget | null;
  request: string;
}): string | null => {
  const wish = request.trim();
  if (!wish || !isId(surveyId)) return null;
  const about =
    target && isId(target.id) && Number.isInteger(target.number)
      ? `, question ${target.number} (id ${target.id})`
      : "";
  return `Change survey ${surveyId}${about}. My request: ${wish}`;
};

export type ChangeRequestOutcome = "sent" | "failed";

/**
 * Builds the message and hands it to `send`. A refusal by the host (`isError`), a thrown error and a
 * message that could not be built all read as `failed`, which the view shows next to a hint to say it in
 * the chat instead.
 */
export const sendChangeRequest = async ({
  send,
  surveyId,
  target,
  request,
}: {
  send: (message: string) => Promise<{ isError?: boolean }>;
  surveyId: string;
  target: ChangeTarget | null;
  request: string;
}): Promise<ChangeRequestOutcome> => {
  const message = buildChangeRequest({ surveyId, target, request });
  if (message === null) return "failed";
  try {
    const result = await send(message);
    return result.isError ? "failed" : "sent";
  } catch {
    return "failed";
  }
};
