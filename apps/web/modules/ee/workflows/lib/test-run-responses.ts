/**
 * The responses a Response completed workflow can be test-run against (ADR 0049): the row the picker
 * shows, how its first answer is summarized, which row is picked by default, and when the picked
 * response is one the trigger would skip. Pure, so the internal list route and the Test run drawer
 * share it and it is unit-tested without either.
 */

/** One row of `GET /api/internal/workflows/{workflowId}/test-responses`. */
export type TWorkflowTestResponse = {
  id: string;
  createdAt: string;
  finished: boolean;
  endingId: string | null;
  /** The first question's answer, as text, cut to `TEST_RESPONSE_FIRST_ANSWER_MAX_LENGTH`. */
  firstAnswer: string | null;
};

export type TWorkflowTestResponsePage = {
  data: TWorkflowTestResponse[];
  meta: { nextCursor: string | null };
};

export const TEST_RESPONSES_PAGE_SIZE = 20;
export const TEST_RESPONSE_FIRST_ANSWER_MAX_LENGTH = 120;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The survey's question ids in survey order, read off its `blocks` JSON without trusting its shape. */
export const getElementIdsFromBlocks = (blocks: unknown): string[] => {
  if (!Array.isArray(blocks)) return [];
  return blocks.flatMap((block) => {
    const elements = isRecord(block) && Array.isArray(block.elements) ? block.elements : [];
    return elements.flatMap((element) =>
      isRecord(element) && typeof element.id === "string" ? [element.id] : []
    );
  });
};

const toAnswerText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  // Multiple choice, ranking, contact info and address answers: their text parts, in order.
  let parts: unknown[] = [];
  if (Array.isArray(value)) parts = value;
  else if (isRecord(value)) parts = Object.values(value);
  return parts
    .map((part) => (typeof part === "string" || typeof part === "number" ? String(part).trim() : ""))
    .filter((part) => part !== "")
    .join(", ");
};

/**
 * The first answered question's answer, in survey order, as one line of text: what tells one
 * response from another in the picker. Questions the survey no longer has are skipped.
 */
export const getFirstAnswerText = (elementIds: string[], data: unknown): string | null => {
  if (!isRecord(data)) return null;
  for (const elementId of elementIds) {
    const text = toAnswerText(data[elementId]).replaceAll(/\s+/g, " ");
    if (text === "") continue;
    return text.length > TEST_RESPONSE_FIRST_ANSWER_MAX_LENGTH
      ? `${text.slice(0, TEST_RESPONSE_FIRST_ANSWER_MAX_LENGTH - 1)}…`
      : text;
  }
  return null;
};

/**
 * The response the picker selects: the one picked, while it is still listed, else the newest
 * completed one (what a real run would fire on), else the newest of any.
 */
export const resolveSelectedTestResponseId = (
  responses: Pick<TWorkflowTestResponse, "id" | "finished">[],
  pickedId: string | null
): string | null => {
  if (pickedId && responses.some((response) => response.id === pickedId)) return pickedId;
  return (responses.find((response) => response.finished) ?? responses[0])?.id ?? null;
};

/** Why a real run would not fire on this response; the Test run still runs it. */
export type TTestResponseMismatch = "partial" | "other_ending";

export const getTestResponseMismatch = (
  response: Pick<TWorkflowTestResponse, "finished" | "endingId">,
  endingCardIds: string[]
): TTestResponseMismatch | null => {
  if (!response.finished) return "partial";
  // No endings selected means every ending; a response that reached none still counts then.
  if (endingCardIds.length === 0) return null;
  return response.endingId && endingCardIds.includes(response.endingId) ? null : "other_ending";
};
