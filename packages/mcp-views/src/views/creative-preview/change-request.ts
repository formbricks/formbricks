/**
 * What "Ask the agent to change something" posts into the chat as the person's own turn. A creative's name
 * is workspace data a colleague wrote, so it stays out of the message: it carries fixed text, the
 * creative's id and the person's own words, and the agent looks the creative up through the id. An id that
 * is not shaped like one means no message at all.
 */

/** A cuid; never free text. */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

/** The message, or `null` when there is nothing to send: no request, or an id that is not an id. */
export const buildChangeRequest = ({
  creativeId,
  request,
}: {
  creativeId: string;
  request: string;
}): string | null => {
  const wish = request.trim();
  if (!wish || !ID_SHAPE.test(creativeId)) return null;
  return `Change creative ${creativeId}. My request: ${wish}`;
};

export type ChangeRequestOutcome = "sent" | "failed";

/**
 * Builds the message and hands it to `send`. A refusal by the host (`isError`), a thrown error and a
 * message that could not be built all read as `failed`; the view then asks the person to type it into the
 * chat instead.
 */
export const sendChangeRequest = async ({
  send,
  creativeId,
  request,
}: {
  send: (message: string) => Promise<{ isError?: boolean }>;
  creativeId: string;
  request: string;
}): Promise<ChangeRequestOutcome> => {
  const message = buildChangeRequest({ creativeId, request });
  if (message === null) return "failed";
  try {
    const result = await send(message);
    return result.isError ? "failed" : "sent";
  } catch {
    return "failed";
  }
};
