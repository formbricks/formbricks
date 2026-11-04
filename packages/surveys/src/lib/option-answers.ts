import { type TI18nString } from "@formbricks/types/i18n";
import { type TResponseData, type TResponseDataValue } from "@formbricks/types/responses";
import {
  type TDropOptionAnswers,
  type TElementOptionsNotShown,
  getOptionListKeys,
} from "@formbricks/types/surveys/show-if";
import { findByLocalizedLabel, getAllLocalizedLabels } from "@/lib/localized-label";

/**
 * Answers without the options a page no longer offers (ENG-6937, P7). The not-shown record keys
 * options by id, but answers name them the way each type stores them: single and multi select and
 * ranking by label in the respondent's language, picture selection by id, matrix as
 * `{ rowLabel: columnLabel }`. An answer emptied this way becomes the type's empty answer (`""`, `[]`
 * or `{}`), so re-submitting it overwrites what the response stored (an update merges `data`).
 */

type TLabelled = { id: string; label?: TI18nString };
type TOptionElement = {
  id: string;
  type: string;
  choices?: TLabelled[];
  rows?: TLabelled[];
  columns?: TLabelled[];
};

/** The labels of the listed items, in every language: an answer given before a language switch counts. */
const labelsOf = (items: TLabelled[] | undefined, ids: string[] | undefined): Set<string> =>
  new Set(
    (items ?? [])
      .filter((item) => ids?.includes(item.id))
      .flatMap((item) => getAllLocalizedLabels(item.label))
  );

/**
 * Whether a select answer value is an "other" text: it names no choice. Only read when the `other`
 * option itself is not offered.
 */
const isOtherText = (element: TOptionElement, value: string, language: string): boolean =>
  value !== "" &&
  findByLocalizedLabel(
    (element.choices ?? []).filter((choice) => choice.id !== "other"),
    value,
    language
  ) === undefined;

/**
 * The answer `value` without the options `notShown` lists. Returns `value` itself when nothing in it
 * was dropped, so a caller can tell a changed answer by reference.
 */
export const dropOptionsFromAnswer = (
  element: TOptionElement,
  notShown: TElementOptionsNotShown,
  value: TResponseDataValue,
  language: string
): TResponseDataValue => {
  const listKeys = getOptionListKeys(element.type);

  // A matrix: `{ rowLabel: columnLabel }`.
  if (listKeys.includes("rows")) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    const hiddenRows = labelsOf(element.rows, notShown.rows);
    const hiddenColumns = labelsOf(element.columns, notShown.columns);
    const entries = Object.entries(value);
    const kept = entries.filter(([row, column]) => !hiddenRows.has(row) && !hiddenColumns.has(column));
    return kept.length === entries.length ? value : Object.fromEntries(kept);
  }
  if (!listKeys.includes("choices")) return value;

  // A picture selection stores the picked ids.
  if (element.type === "pictureSelection") {
    const ids = notShown.choices ?? [];
    if (!Array.isArray(value)) return value;
    const kept = value.filter((entry) => !ids.includes(entry));
    return kept.length === value.length ? value : kept;
  }

  // Single and multi select and ranking store labels.
  const hiddenLabels = labelsOf(element.choices, notShown.choices);
  const otherHidden = element.type !== "ranking" && (notShown.choices ?? []).includes("other");
  const isDropped = (entry: string) =>
    hiddenLabels.has(entry) || (otherHidden && isOtherText(element, entry, language));

  if (typeof value === "string") return isDropped(value) ? "" : value;
  if (Array.isArray(value)) {
    const kept = value.filter((entry) => !isDropped(entry));
    return kept.length === value.length ? value : kept;
  }
  return value;
};

/** `getBlockVisibility`'s answer dropping, for answers in `language`. */
export const createDropOptionAnswers =
  (language: string): TDropOptionAnswers<TResponseData> =>
  (element, notShown, data) => {
    const value = data[element.id];
    if (value === undefined) return data;
    const next = dropOptionsFromAnswer(element as TOptionElement, notShown, value, language);
    return next === value ? data : { ...data, [element.id]: next };
  };
