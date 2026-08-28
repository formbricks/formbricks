import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";

/** One question row as the preview renders it, flattened out of the block structure. */
export interface TAiDraftQuestion {
  /** Stable for the row's whole life: the model appends, so a question never changes position. */
  key: string;
  /** Which block it belongs to. Kept so the preview can show the structure the model wrote. */
  blockKey: string;
  /** The model is asked to give every block a short, meaningful name; this is that name. */
  blockName?: string;
  type?: string;
  headline?: string;
  choiceCount?: number;
}

export interface TAiDraftState {
  name?: string;
  questions: readonly TAiDraftQuestion[];
}

export const EMPTY_AI_DRAFT: TAiDraftState = { questions: [] };

/**
 * Fold a streamed snapshot into the draft the preview renders.
 *
 * Two properties carry the whole feel of the streaming UI, and both are load-bearing rather than
 * defensive:
 *
 * 1. **Append-only, keyed by position in the draft.** A snapshot that arrives with fewer questions,
 *    or with a field blanked out, loses to what is already there. Matching is by `key` rather than by
 *    index because a question the model has not started writing is skipped entirely, so the flattened
 *    array shifts under you: a later snapshot that fills in question 0 would otherwise align it with
 *    question 1 and emit the same key twice.
 *
 * 2. **Referential stability.** Any question whose fields did not change comes back as the *same
 *    object*, and the whole state object comes back unchanged when nothing moved. Paired with a
 *    memoised row component, extending question seven's headline re-renders one row instead of
 *    thirty-two. Without it, full-snapshot streaming re-renders the entire list several times a
 *    second and every row visibly flickers.
 */
export function mergeAiDraftSnapshot(
  previous: TAiDraftState,
  snapshot: TSurveyGenerationDraftSnapshot
): TAiDraftState {
  const incoming = flattenSnapshotQuestions(snapshot);
  const byKey = new Map(previous.questions.map((question) => [question.key, question]));
  const questions: TAiDraftQuestion[] = [...previous.questions];
  let changed = false;

  for (const incomingQuestion of incoming) {
    const previousQuestion = byKey.get(incomingQuestion.key);

    if (!previousQuestion) {
      questions.push(incomingQuestion);
      byKey.set(incomingQuestion.key, incomingQuestion);
      changed = true;
      continue;
    }

    const merged: TAiDraftQuestion = {
      key: previousQuestion.key,
      blockKey: previousQuestion.blockKey,
      blockName: incomingQuestion.blockName ?? previousQuestion.blockName,
      type: incomingQuestion.type ?? previousQuestion.type,
      headline: incomingQuestion.headline ?? previousQuestion.headline,
      choiceCount: incomingQuestion.choiceCount ?? previousQuestion.choiceCount,
    };

    if (isSameQuestion(previousQuestion, merged)) continue;

    questions[questions.indexOf(previousQuestion)] = merged;
    byKey.set(merged.key, merged);
    changed = true;
  }

  const name = typeof snapshot.name === "string" && snapshot.name.length > 0 ? snapshot.name : previous.name;
  if (name !== previous.name) {
    changed = true;
  }

  return changed ? { name, questions } : previous;
}

/** Rows currently worth rendering: a question exists once the model has committed to its type. */
function flattenSnapshotQuestions(snapshot: TSurveyGenerationDraftSnapshot): TAiDraftQuestion[] {
  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];
  const questions: TAiDraftQuestion[] = [];

  blocks.forEach((block, blockIndex) => {
    const blockQuestions = Array.isArray(block?.questions) ? block.questions : [];

    blockQuestions.forEach((question, questionIndex) => {
      if (!question) return;

      const type = typeof question.type === "string" ? question.type : undefined;
      const headline = typeof question.headline === "string" ? question.headline : undefined;

      // A row earns its place as soon as either field lands; before that there is nothing to show
      // and a placeholder would just be a row that appears and then jumps.
      if (!type && !headline) return;

      questions.push({
        key: `${blockIndex}:${questionIndex}`,
        blockKey: String(blockIndex),
        blockName: typeof block?.name === "string" && block.name.length > 0 ? block.name : undefined,
        type,
        headline,
        choiceCount: Array.isArray(question.choices) ? question.choices.length : undefined,
      });
    });
  });

  return questions;
}

function isSameQuestion(a: TAiDraftQuestion, b: TAiDraftQuestion): boolean {
  return (
    a.type === b.type &&
    a.headline === b.headline &&
    a.choiceCount === b.choiceCount &&
    a.blockName === b.blockName
  );
}

/** Group the flat rows back into the blocks the model wrote, preserving order. */
export function groupAiDraftByBlock(
  questions: readonly TAiDraftQuestion[]
): { key: string; name?: string; questions: TAiDraftQuestion[] }[] {
  const blocks: { key: string; name?: string; questions: TAiDraftQuestion[] }[] = [];

  for (const question of questions) {
    const current = blocks.at(-1);
    if (current?.key === question.blockKey) {
      current.questions.push(question);
      current.name ??= question.blockName;
      continue;
    }

    blocks.push({ key: question.blockKey, name: question.blockName, questions: [question] });
  }

  return blocks;
}
