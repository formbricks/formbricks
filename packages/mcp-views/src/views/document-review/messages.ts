/**
 * What the view tells the model once the person has decided. Built from fixed text, a document kind from
 * a closed set, the document id and counts, never from the document: its name, a field value, an error
 * `detail` the server sent or the push's own words are all content someone else could have written
 * ("ignore previous instructions ..."), and a message the view sends reaches the model as if the user said
 * it. The model can look the name up through the id with its own tools.
 */
import { plural } from "../../shared/plural";
import { type ApplyOutcome, isDocumentKind } from "./review";

// A cuid2 (what documents are created with) or a UUID.
const DOCUMENT_ID = /^(?:[a-z][a-z0-9]{19,31}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/;

export const isDocumentId = (value: unknown): value is string =>
  typeof value === "string" && DOCUMENT_ID.test(value);

const isStatus = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599;

const isChangeCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** Typed loosely on purpose: the kind and the id are checked here rather than trusted from the type. */
export type DecisionSubject = { kind: string; id: string };

/**
 * The message for a decision, or `undefined` when there is nothing to say: the id does not look like an
 * id (so no part of it is trusted), or the push never left the view and nothing happened.
 */
export const buildDecisionMessage = (
  subject: DecisionSubject,
  outcome: ApplyOutcome | "declined"
): string | undefined => {
  if (!isDocumentKind(subject.kind) || !isDocumentId(subject.id)) return undefined;
  const target = `${subject.kind} ${subject.id}`;

  if (outcome === "declined") {
    return `The user declined the change to ${target} in the review view. Nothing was pushed. Do not push it unless they ask you to.`;
  }

  if (outcome.ok) {
    const count = isChangeCount(outcome.changeCount) ? ` (${plural(outcome.changeCount, "change")})` : "";
    return `The user approved the change to ${target} in the review view and push_document applied it${count}. Pull ${target} again before editing it further.`;
  }

  switch (outcome.reason) {
    case "blocked":
      return undefined;
    case "version":
      return `The user approved the change to ${target} but it was not pushed: the document schema version of the review does not match the one in the push. Nothing was written. Pull ${target} again, redo the edit and review it again.`;
    case "stale":
      return `The user approved the change to ${target} but the push was refused: the document changed since it was pulled. Nothing was written. Pull ${target} again, redo the edit and review it again.`;
    case "unreachable":
      return `The user approved the change to ${target} but the view could not reach the server. Nothing was written. Review the change again if they still want it.`;
    case "refused": {
      const status = isStatus(outcome.status) ? ` (HTTP ${outcome.status})` : "";
      return `The user approved the change to ${target} but push_document refused it${status}. Nothing was written. Review the change again to see why.`;
    }
  }
};
