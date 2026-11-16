import type { InvalidParam } from "@/app/api/v3/lib/response";
import { encodeKeySegment } from "@/modules/survey/lib/survey-texts";
import type { TExcelExportRead } from "./read";

/**
 * An Update's refusal of an imported Excel export, named by the sheet's rows (ENG-6809). The Update
 * names what it refuses by the survey's field path (`survey.blocks.1.elements.0.choices.1.label.en-US`),
 * which says nothing to someone looking at a sheet; here each name becomes the row that holds the text,
 * and its language: `R5 (en-US)`, as the import report names rows. A name that leads to no row of the
 * sheet is left as it is.
 */

type TDraftElement = { id?: unknown; choices?: unknown; rows?: unknown; columns?: unknown };
type TDraft = { blocks?: unknown };

const OPTION_LISTS: Record<string, string> = { choices: "choice", rows: "row", columns: "column" };

const idAt = (list: unknown, index: string): string | null => {
  const entry = Array.isArray(list) ? (list[Number(index)] as { id?: unknown } | undefined) : undefined;
  return typeof entry?.id === "string" ? entry.id : null;
};

/** The text key a field path leads to, and the language its last segment names, if any. */
const toTextKey = (
  name: string,
  draft: TDraft,
  languages: ReadonlySet<string>
): { key: string; language: string | null } | null => {
  const segments = name.replace(/^survey\./, "").split(".");
  const [blocksWord, blockIndex, elementsWord, elementIndex, ...rest] = segments;
  if (blocksWord !== "blocks" || elementsWord !== "elements" || !Array.isArray(draft.blocks)) return null;
  const block = draft.blocks[Number(blockIndex)] as { elements?: unknown } | undefined;
  const element = (Array.isArray(block?.elements) ? block.elements[Number(elementIndex)] : undefined) as
    | TDraftElement
    | undefined;
  if (typeof element?.id !== "string") return null;

  const language = rest.length > 0 && languages.has(rest.at(-1) ?? "") ? (rest.pop() ?? null) : null;
  const elementKey = `element.${encodeKeySegment(element.id)}`;
  const [field, index, property] = rest;
  const list = field ? OPTION_LISTS[field] : undefined;
  if (list && index !== undefined) {
    const optionId = idAt(element[field as keyof TDraftElement], index);
    if (!optionId) return { key: `${elementKey}.headline`, language };
    return { key: `${elementKey}.${list}.${encodeKeySegment(optionId)}.${property ?? "label"}`, language };
  }
  return { key: field ? `${elementKey}.${field}` : `${elementKey}.headline`, language };
};

export const nameRefusalsBySheetRow = (
  refusal: InvalidParam[],
  draft: TDraft,
  read: Pick<TExcelExportRead, "rows">,
  /** The survey's language codes as the Update names them: the last segment of a text's path. */
  languages: readonly string[]
): InvalidParam[] => {
  const rowsByKey = new Map(read.rows.filter((row) => row.key).map((row) => [row.key, row.row]));
  const codes = new Set(languages);
  return refusal.map((param) => {
    const target = toTextKey(param.name, draft, codes);
    if (!target) return param;
    const elementKey = target.key.split(".").slice(0, 2).join(".");
    const row = rowsByKey.get(target.key) ?? rowsByKey.get(`${elementKey}.headline`);
    if (row === undefined) return param;
    return { ...param, name: target.language ? `R${row} (${target.language})` : `R${row}` };
  });
};
