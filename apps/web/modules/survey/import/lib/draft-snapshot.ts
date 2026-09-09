import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import { stripHtml } from "@/modules/survey/import/lanes/qsf/strip-html";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Public locale map → the localized array the review list understands (default language first).
 * Headlines from the editor are rich text (`<p class="fb-editor-paragraph">…`); the list shows the words.
 */
function toLocalizedText(value: unknown, defaultLanguage: string): unknown {
  if (typeof value === "string") return stripHtml(value);
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value)
    .filter(([, text]) => typeof text === "string")
    .map(([code, text]) => [code, stripHtml(text as string)] as [string, string]);
  if (entries.length === 0) return undefined;

  entries.sort(([left], [right]) => {
    if (left === defaultLanguage) return -1;
    if (right === defaultLanguage) return 1;
    return left.localeCompare(right);
  });

  // One language reads as a plain string; several show up as badges on the row.
  return entries.length === 1
    ? entries[0][1]
    : entries.map(([languageCode, text]) => ({ languageCode, text }));
}

/**
 * Project a resolved v3 document onto the shape the streaming review list renders, so a JSON or QSF
 * import lands in the same list Create with AI streams into. Display only; the payload is the
 * document itself.
 */
export function documentToDraftSnapshot(document: Record<string, unknown>): TSurveyGenerationDraftSnapshot {
  const defaultLanguage = typeof document.defaultLanguage === "string" ? document.defaultLanguage : "en-US";
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];

  return {
    name: typeof document.name === "string" ? document.name : undefined,
    blocks: blocks.map((block) => {
      const record = isRecord(block) ? block : {};
      const elements = Array.isArray(record.elements) ? record.elements : [];
      return {
        name: typeof record.name === "string" ? record.name : undefined,
        questions: elements.map((element) => {
          const item = isRecord(element) ? element : {};
          const choices = Array.isArray(item.choices)
            ? item.choices
            : Array.isArray(item.rows)
              ? item.rows
              : undefined;
          return {
            type: typeof item.type === "string" ? item.type : undefined,
            headline: toLocalizedText(item.headline, defaultLanguage),
            ...(choices ? { choices: choices.map(() => "") } : {}),
          };
        }),
      };
    }),
  } as unknown as TSurveyGenerationDraftSnapshot;
}
