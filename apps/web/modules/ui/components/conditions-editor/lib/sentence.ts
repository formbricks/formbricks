import type { TConnector } from "@formbricks/types/surveys/logic";

/**
 * The sentence layout of the conditions editor (ENG-6969 T6), opt in through `variant="sentence"`:
 * the rule reads "If … and … and …". There is no separate "When [all are true]" row: the connector
 * is picked in a small select before the second condition and repeated as text before the rest.
 */

/**
 * One row of the sentence: label · fields · actions. The label and actions columns have fixed widths,
 * so every row (a condition, or one of the rule's actions with the same classes) lines up. The label
 * column fits the and/or select ("and ▾"), the widest thing it holds, not only "If" and "Then".
 */
export const SENTENCE_ROW_CLASS = "grid grid-cols-[4rem_minmax(0,1fr)_3.75rem] items-start gap-x-2";

/**
 * A row's fields: field · operator · value side by side when the editor has room (a container query
 * on the nearest `@container`), stacked in a narrow editor column. An action's target spans the
 * operator and value columns (`@xl:col-span-2`), so right edges line up.
 */
export const SENTENCE_FIELDS_CLASS =
  "grid min-w-0 grid-cols-1 gap-2 @xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]";

/** The label column: "If", "and", "Then", or the and/or select, right-aligned on the first line. */
export const SENTENCE_LEAD_CLASS = "flex h-10 items-center justify-end text-sm font-medium text-slate-700";

/** The actions column: borderless delete and ⋮, on the first line. */
export const SENTENCE_ROW_ACTIONS_CLASS = "flex h-10 items-center justify-end gap-0.5";

/** A borderless icon button in the actions column: delete, or the ⋮ menu's trigger. */
export const SENTENCE_ICON_BUTTON_CLASS = "size-7 text-slate-500 hover:text-slate-900";

/** What stands in the label column before a condition. */
export type TSentenceLead =
  | { kind: "if" }
  | { kind: "select" }
  | { kind: "text"; connector: TConnector }
  | { kind: "none" };

export const getSentenceLead = ({
  index,
  depth,
  connector,
  isConnectorLocked = false,
}: {
  /** The condition's position in its group. */
  index: number;
  /** 0 for the rule's own conditions, more inside a nested group. */
  depth: number;
  connector: TConnector;
  isConnectorLocked?: boolean;
}): TSentenceLead => {
  // A nested group's first condition: the connector before the group's box already joins it.
  if (index === 0) return depth === 0 ? { kind: "if" } : { kind: "none" };
  if (index === 1 && !isConnectorLocked) return { kind: "select" };
  return { kind: "text", connector };
};

/**
 * The operator a condition starts with once its field is picked: the editor's default when the field
 * offers it, else the field's first. A show-if draft opens without a field (ENG-6969 T6), so the field
 * picked first may be a hidden field, whose operators the default (a question's) needn't be among.
 */
export const getOperatorForField = (
  options: readonly { value: string | number }[],
  preferred: string
): string =>
  options.length === 0 || options.some((option) => option.value === preferred)
    ? preferred
    : String(options[0].value);

/**
 * The and/or select's choice, written as the group's `connector` through the editor's toggle callback.
 * Picking the connector the group already has changes nothing.
 */
export const pickConnector = (
  group: { id: string; connector: TConnector },
  picked: TConnector,
  toggleGroupConnector: (groupId: string) => void
): void => {
  if (picked !== group.connector) toggleGroupConnector(group.id);
};
