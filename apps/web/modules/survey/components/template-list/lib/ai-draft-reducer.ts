import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";

/** One question row as the preview renders it, flattened out of the block structure. */
export interface TAiDraftQuestion {
  /** `block:question`, and the row's position in the draft — stable for its whole life. */
  key: string;
  /** Which block it belongs to. Kept so the preview can show the structure the model wrote. */
  blockKey: string;
  /** The model is asked to give every block a short, meaningful name; this is that name. */
  blockName?: string;
  type?: string;
  headline?: string;
  choiceCount?: number;
  /** Language codes the row already has text for; import drafts carry several, prompts none. */
  languages?: readonly string[];
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
  snapshot: TSurveyGenerationDraftSnapshot,
  /** Blocks already finalized by earlier chunks of a long import; the snapshot's indices start after them. */
  blockOffset = 0
): TAiDraftState {
  const incoming = flattenSnapshotQuestions(snapshot, blockOffset);
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
      ...((incomingQuestion.languages ?? previousQuestion.languages)
        ? { languages: incomingQuestion.languages ?? previousQuestion.languages }
        : {}),
    };

    if (isSameQuestion(previousQuestion, merged)) continue;

    questions[questions.indexOf(previousQuestion)] = merged;
    byKey.set(merged.key, merged);
    changed = true;
  }

  // Ordered by position, not by arrival. A question is only flattened once it has a type or a
  // headline, so one that is still empty is skipped and lands in a later snapshot — appending it
  // would render question 2 above question 1, and that wrong order would survive into review.
  if (changed) {
    questions.sort((a, b) => comparePosition(a.key, b.key));
  }

  const name = typeof snapshot.name === "string" && snapshot.name.length > 0 ? snapshot.name : previous.name;
  if (name !== previous.name) {
    changed = true;
  }

  return changed ? { name, questions } : previous;
}

/**
 * Replace the draft with a snapshot instead of folding it in. The import dialog uses this for the
 * resolved document at the end of a run: the resolver regroups blocks (rating-like questions get their
 * own block, chunks are merged), so its keys no longer line up with the streamed partials and an
 * append-only merge would keep stale rows next to the new ones.
 */
export function replaceAiDraftSnapshot(snapshot: TSurveyGenerationDraftSnapshot): TAiDraftState {
  const questions = flattenSnapshotQuestions(snapshot, 0).sort((a, b) => comparePosition(a.key, b.key));
  return {
    ...(typeof snapshot.name === "string" && snapshot.name.length > 0 ? { name: snapshot.name } : {}),
    questions,
  };
}

/** `block:question` keys, compared numerically — "10:0" sorts after "9:0", which strings do not. */
function comparePosition(a: string, b: string): number {
  const [aBlock = 0, aQuestion = 0] = a.split(":").map(Number);
  const [bBlock = 0, bQuestion = 0] = b.split(":").map(Number);

  return aBlock - bBlock || aQuestion - bQuestion;
}

/** Rows currently worth rendering: a question exists once the model has committed to its type. */
function flattenSnapshotQuestions(
  snapshot: TSurveyGenerationDraftSnapshot,
  blockOffset: number
): TAiDraftQuestion[] {
  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];
  const questions: TAiDraftQuestion[] = [];

  blocks.forEach((block, localBlockIndex) => {
    const blockIndex = localBlockIndex + blockOffset;
    const blockQuestions = Array.isArray(block?.questions) ? block.questions : [];

    blockQuestions.forEach((question, questionIndex) => {
      if (!question) return;

      const type = typeof question.type === "string" ? question.type : undefined;
      const localized = readLocalizedText(question.headline);
      const headline = localized.text;

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
        ...(localized.languages ? { languages: localized.languages } : {}),
      });
    });
  });

  return questions;
}

/**
 * A draft text is a plain string (Create with AI) or, for multilingual imports, a list of
 * `{ languageCode, text }` entries (D2). The row shows the first text and badges the languages.
 */
function readLocalizedText(value: unknown): { text?: string; languages?: string[] } {
  if (typeof value === "string") return { text: value };
  if (!Array.isArray(value)) return {};

  const entries = value.filter(
    (entry): entry is { languageCode?: string; text?: string } => typeof entry === "object" && entry !== null
  );
  const first = entries.find((entry) => typeof entry.text === "string");
  const languages = entries
    .map((entry) => entry.languageCode)
    .filter((code): code is string => typeof code === "string" && code.length > 0);

  return {
    ...(first ? { text: first.text } : {}),
    ...(languages.length > 0 ? { languages } : {}),
  };
}

function isSameQuestion(a: TAiDraftQuestion, b: TAiDraftQuestion): boolean {
  return (
    a.type === b.type &&
    a.headline === b.headline &&
    a.choiceCount === b.choiceCount &&
    a.blockName === b.blockName &&
    (a.languages ?? []).join(",") === (b.languages ?? []).join(",")
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
