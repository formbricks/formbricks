import { getTextContent } from "@formbricks/types/surveys/validation";
import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyRequestBody } from "@/app/api/v3/surveys/schemas";
import { extractId, extractRecallInfo, replaceRecallInfoWithUnderline } from "@/lib/utils/recall";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The text a review row shows for a translated field: the default language's, else the `default` key,
 * else the first. Headlines can carry the editor's HTML, and the row is plain text.
 */
const readText = (value: unknown, defaultLanguage: string | undefined): string | undefined => {
  if (typeof value === "string") return getTextContent(value) || undefined;
  if (!isRecord(value)) return undefined;

  const keys = Object.keys(value);
  const preferred = defaultLanguage?.toLowerCase();
  const key =
    keys.find((candidate) => candidate.toLowerCase() === preferred) ??
    keys.find((candidate) => candidate === "default") ??
    keys[0];
  const text = key === undefined ? undefined : value[key];
  return typeof text === "string" ? getTextContent(text) || undefined : undefined;
};

/**
 * A text's recalls as the editor writes them in plain text (`recallToHeadline`): `@` and what is
 * recalled, instead of the stored token. A question shows its headline; anything else, such as a
 * hidden field, its id, which is the field's name.
 */
const showRecalls = (text: string, labels: ReadonlyMap<string, string>): string => {
  let shown = text;
  for (let token = extractRecallInfo(shown); token; token = extractRecallInfo(shown)) {
    const id = extractId(token) ?? "";
    shown = shown.replace(token, () => `@${labels.get(id) ?? id}`);
  }
  return shown;
};

/** Choices, or a matrix's rows: what the row's "N options" counts. */
const countOptions = (element: Record<string, unknown>): number | undefined => {
  if (Array.isArray(element.choices)) return element.choices.length;
  if (Array.isArray(element.rows)) return element.rows.length;
  return undefined;
};

/**
 * The import's draft in the shape the review list renders. Create with AI streams these snapshots as
 * the model writes; the import has no partials, so its list is built once from the finished payload.
 * Display only — the payload itself is what gets created.
 */
export const payloadToDraftSnapshot = (
  payload: TV3CreateSurveyRequestBody
): TSurveyGenerationDraftSnapshot => {
  // Read as plain data: the review only needs a few fields, and tolerates any it cannot read.
  const body: Record<string, unknown> = isRecord(payload) ? payload : {};
  const defaultLanguage = typeof body.defaultLanguage === "string" ? body.defaultLanguage : undefined;
  const blocks: unknown[] = Array.isArray(body.blocks) ? body.blocks : [];
  const elementsOf = (block: Record<string, unknown>) =>
    (Array.isArray(block.elements) ? block.elements : []).filter(isRecord);
  // What a recall of each question shows. Labels carry no tokens (a recall inside one reads `___`, as
  // in the editor), so replacing the tokens of a text always ends.
  const recallLabels = new Map<string, string>();
  for (const element of blocks.filter(isRecord).flatMap(elementsOf)) {
    const headline = readText(element.headline, defaultLanguage);
    if (typeof element.id === "string" && headline) {
      recallLabels.set(element.id, replaceRecallInfoWithUnderline(headline));
    }
  }

  return {
    name: typeof body.name === "string" ? body.name : undefined,
    blocks: blocks.filter(isRecord).map((block) => ({
      name: typeof block.name === "string" ? block.name : undefined,
      questions: elementsOf(block).map((element) => {
        const optionCount = countOptions(element);
        const headline = readText(element.headline, defaultLanguage);
        return {
          type: typeof element.type === "string" ? element.type : undefined,
          headline: headline && showRecalls(headline, recallLabels),
          ...(optionCount === undefined ? {} : { choices: Array.from({ length: optionCount }, () => "") }),
        };
      }),
    })),
  } as TSurveyGenerationDraftSnapshot;
};
