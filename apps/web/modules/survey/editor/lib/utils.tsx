import { TFunction } from "i18next";
import { HTMLInputTypeAttribute, JSX } from "react";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import {
  RESERVED_FIELD_CATALOG,
  type TLinkedEmbeddedField,
  type TReservedFieldCatalogEntry,
  getComputedEmbeddedFields,
  getSurveyEmbeddedFields,
  listMidSurveyReservedEntries,
  listShadowingNames,
} from "@formbricks/types/embedded-data-resolver";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSurveyBlockLogic, TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  TConditionGroup,
  TLeftOperand,
  TRightOperand,
  TSingleCondition,
  TSurveyLogicConditionsOperator,
} from "@formbricks/types/surveys/logic";
import {
  TSurvey,
  TSurveyEndings,
  TSurveyVariable,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { isConditionGroup } from "@/lib/surveyLogic/utils";
import { recallToHeadline } from "@/lib/utils/recall";
import {
  EMBEDDED_FIELD_ICON_BY_DATA_TYPE,
  getReservedFieldIcon,
  getReservedFieldLabel,
} from "@/modules/embedded-data/lib/field-display";
import { findElementLocation, getBlockDisplayName } from "@/modules/survey/editor/lib/blocks";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { type TElement, getElementTypes, getTSurveyElementTypeEnumName } from "@/modules/survey/lib/elements";
import { TConditionValueProps } from "@/modules/ui/components/conditions-editor/types";
import { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import { TLogicRuleOption, getLogicRules } from "./logic-rule-engine";

export const MAX_STRING_LENGTH = 2000;

export const scrollElementCardIntoView = (elementId: string, block: ScrollLogicalPosition = "center") => {
  if (typeof window === "undefined") return;
  // Double rAF: first frame flushes React state + DOM mutations (new card mounted, Collapsible opened);
  // second frame waits for layout/paint so scrollIntoView computes the final position.
  // The target's scroll-mt clears the fixed tabs bar; use block "start" to land the card top below it.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const node = document.getElementById(elementId);
      node?.scrollIntoView({ behavior: "smooth", block });
    });
  });
};

export const extractParts = (text: string): string[] => {
  const parts: string[] = [];
  let i = 0;

  if (text.length > MAX_STRING_LENGTH) {
    // If the text is unexpectedly too long, return it as a single part
    parts.push(text);
    return parts;
  }

  while (i < text.length) {
    const start = text.indexOf("/", i);
    if (start === -1) {
      // No more `/`, push the rest and break
      parts.push(text.slice(i));
      break;
    }
    const end = text.indexOf("\\", start + 1);
    if (end === -1) {
      // No matching `\`, treat as plain text
      parts.push(text.slice(i));
      break;
    }
    // Add text before the match
    if (start > i) {
      parts.push(text.slice(i, start));
    }
    // Add the highlighted part (without `/` and `\`)
    parts.push(text.slice(start + 1, end));
    // Move past the `\`
    i = end + 1;
  }

  if (parts.length === 0) {
    parts.push(text);
  }

  return parts;
};

// formats the text to highlight specific parts of the text with slashes
export const formatTextWithSlashes = (
  text: string,
  prefix: string = "",
  classNames: string[] = ["text-xs"]
): (string | JSX.Element)[] => {
  const parts = extractParts(text);

  return parts.map((part, index) => {
    // Check if the part was inside slashes
    if (index % 2 !== 0) {
      return (
        <span
          key={index}
          className={`mx-1 rounded-md bg-slate-100 p-1 px-2${classNames ? ` ${classNames.join(" ")}` : ""}`}>
          {prefix}
          {part}
        </span>
      );
    } else {
      return part;
    }
  });
};

const getElementIconMapping = (t: TFunction): Record<string, TElement["icon"]> =>
  getElementTypes(t).reduce<Record<string, TElement["icon"]>>(
    (prev, curr) => ({
      ...prev,
      [curr.id]: curr.icon,
    }),
    {}
  );

const getElementHeadline = (
  localSurvey: TSurvey,
  element: TSurveyElement,
  languageCode: string,
  t: TFunction
): string => {
  const headlineData = recallToHeadline(element.headline, localSurvey, false, languageCode);
  const headlineText = headlineData[languageCode];
  if (headlineText) {
    const textContent = getTextContent(headlineText);
    if (textContent.length > 0) {
      return textContent;
    }
  }
  return getTSurveyElementTypeEnumName(element.type, t) ?? "";
};

/**
 * ENG-1837: the editor's view of one computed Embedded Data field. The calculate action renders and
 * filters on an id/name/type triple, so the definitions are adapted to that shape once here rather
 * than reshaped at each of the pickers below.
 *
 * ENG-2628: sourced from the survey's rows, like every other reader. The editor's working copy is
 * now rows-native — the Variables and Hidden Fields cards edit `embeddedFields` directly — so a
 * card edit reaches these pickers on the next render without anything being derived here.
 *
 * ENG-1853: the *condition* pickers no longer go through this — they offer one Embedded Data group
 * built by {@link getEmbeddedFieldOptions}. What is left is the calculate action, which really does
 * target computed fields alone (there is nothing to assign to an ingested one), plus the operator
 * lookup for a `variable` operand.
 */
interface TComputedFieldOption {
  id: string;
  name: string;
  type: "text" | "number";
}

const getComputedFieldOptions = (localSurvey: TSurvey): TComputedFieldOption[] =>
  getComputedEmbeddedFields(localSurvey).map(({ field, link }) => ({
    id: link.storageKey,
    name: field.name,
    type: field.dataType === "number" ? "number" : "text",
  }));

/**
 * Every name a survey already declares — the shadow list the grandfather rule filters against. All
 * three declaration kinds count: an ingested field, a variable and an element id are equally capable
 * of being named `country`, and any of them resolves ahead of the reserved entry at read time,
 * because the merged value map spreads `responseData` (which is keyed by element id) over the
 * reserved projection.
 */
const getDeclaredFieldNames = (localSurvey: TSurvey): string[] =>
  // `listShadowingNames` so the picker and the two value maps (the renderer's and
  // `buildServerEmbeddedValues`) agree on what "declared" means from one definition — ENG-2538 fixed
  // the value maps by giving them this same list. The rows, like every other reader: ENG-2628 made
  // the editor's working copy rows-native, so there is nothing left for it to derive.
  listShadowingNames(
    getSurveyEmbeddedFields(localSurvey),
    getElementsFromBlocks(localSurvey.blocks).map((element) => element.id)
  );

/** The reserved entries this survey may offer mid-survey, already availability- and shadow-filtered. */
const getPickerReservedEntries = (localSurvey: TSurvey): TReservedFieldCatalogEntry[] =>
  listMidSurveyReservedEntries(RESERVED_FIELD_CATALOG, getDeclaredFieldNames(localSurvey));

/**
 * Which HTML input the literal comparison value gets, per dataType. A map rather than a chain of
 * ternaries so it stays exhaustive: adding a dataType is a compile error here instead of silently
 * falling through to a text box.
 *
 * `boolean` has no entry because a boolean operand offers no input at all (ENG-1853) — it picks from
 * the two stored spellings, see {@link getBooleanValueProps}. `date` reaches `InputCombobox`, which
 * renders `DatePicker` rather than a raw `<input type="date">` for it.
 */
const INPUT_TYPE_BY_DATA_TYPE: Record<Exclude<TEmbeddedDataType, "boolean">, HTMLInputTypeAttribute> = {
  string: "text",
  number: "number",
  date: "date",
};

/**
 * One Embedded Data field as an operand option.
 *
 * **`meta.type` is the stored discriminator and it does not move.** ENG-1853 merged the Variables
 * and Hidden Fields *groups*; the data model still has two sources, and `ConditionsEditor` copies
 * this `meta` straight onto `leftOperand.type` / `rightOperand.type`. Emitting one merged type here
 * would rewrite every condition an author touches into something neither
 * {@link getConditionOperatorOptions} nor the runtime evaluator can read.
 *
 * `meta.hint` is the workspace library key, which only a shared field has — `TReadableField`'s
 * `secondaryLabel` carries the reasoning for why a key earns its own dim line beside a name.
 */
const toEmbeddedFieldOption = ({ field, link }: TLinkedEmbeddedField): TComboboxOption => ({
  icon: EMBEDDED_FIELD_ICON_BY_DATA_TYPE[field.dataType],
  label: field.name.trim() === "" ? link.storageKey : field.name,
  value: link.storageKey,
  meta: {
    type: field.source === "computed" ? "variable" : "hiddenField",
    ...(field.key === null ? {} : { hint: field.key }),
  },
});

/**
 * Which Embedded Data fields may sit opposite a `wanted`-typed operand. Merging two groups into one
 * is a change of *label*, so this reproduces today's two filters rather than inventing a single rule
 * that would quietly drop rows from surveys that already have them:
 *
 * - a **computed** field (ex-variable) must match the wanted type — a text variable was never
 *   offered against a numeric comparison — except against a `date`, where today's Date branch does
 *   offer text variables, whose values are free text a respondent may well have typed a date into.
 * - an **ingested** field (ex-hidden-field) that is a `string` is offered against everything. Every
 *   field a legacy survey has is one and today's lists never filtered them: hidden fields stayed in
 *   every list because they were untyped strings. One that declares a narrower type is held to it,
 *   which is what stops a `boolean` field turning up under a numeric comparison.
 */
const isEmbeddedFieldComparableAs = (
  field: TLinkedEmbeddedField["field"],
  wanted: TEmbeddedDataType
): boolean => {
  if (field.dataType === wanted) return true;
  if (field.dataType !== "string") return false;
  return field.source === "ingested" || wanted === "date";
};

interface TEmbeddedFieldOptionFilter {
  /** A storage key to leave out — usually the operand already on the other side of the comparison. */
  exclude?: string;
  /** Keeps only fields whose value can be compared against this type. */
  comparableAs?: TEmbeddedDataType;
  /** Keeps only fields of this source. The numeric-scale branches offer computed fields alone. */
  source?: TLinkedEmbeddedField["field"]["source"];
}

/**
 * The survey's Embedded Data fields as operand options — one group where the UI used to draw two
 * (ENG-1853), in the rows' own order rather than variables-then-hidden-fields.
 */
const getEmbeddedFieldOptions = (
  localSurvey: TSurvey,
  filter: TEmbeddedFieldOptionFilter = {}
): TComboboxOption[] =>
  getSurveyEmbeddedFields(localSurvey)
    .filter(({ field, link }) => {
      if (link.storageKey === filter.exclude) return false;
      if (filter.source !== undefined && field.source !== filter.source) return false;
      return filter.comparableAs === undefined || isEmbeddedFieldComparableAs(field, filter.comparableAs);
    })
    .map(toEmbeddedFieldOption);

/**
 * One auto-captured field as an operand option. The label comes from `getReservedFieldLabel`, the
 * same helper the response table and the response filter use, so the editor calls a field `URL`
 * where they do rather than title-casing the catalog name into `Url` (ENG-1853).
 */
const toReservedOption = (entry: TReservedFieldCatalogEntry, t: TFunction): TComboboxOption => ({
  icon: getReservedFieldIcon(entry.name),
  label: getReservedFieldLabel(entry.name, t),
  value: entry.name,
  meta: {
    type: "reserved",
  },
});

/**
 * The groups every field picker draws, in one fixed order (ENG-1853): the survey's own questions,
 * then its Embedded Data, then what Formbricks captures by itself. An empty group is dropped rather
 * than drawn as a heading with nothing under it.
 *
 * A group's `value` is its key inside `InputCombobox` and never reaches storage — an option's
 * `meta.type` is what a saved condition carries — so `reservedFields` keeps its spelling even though
 * the heading it now renders reads "Auto-captured".
 */
const toOperandGroups = (
  t: TFunction,
  groups: {
    /** The element's own answer options, which are static values rather than references. */
    choices?: TComboboxOption[];
    questions?: TComboboxOption[];
    embeddedData?: TComboboxOption[];
    autoCaptured?: TComboboxOption[];
  }
): TComboboxGroupedOption[] => {
  const grouped: TComboboxGroupedOption[] = [];

  if (groups.choices?.length) {
    grouped.push({ label: t("common.choices"), value: "choices", options: groups.choices });
  }
  if (groups.questions?.length) {
    grouped.push({ label: t("common.questions"), value: "elements", options: groups.questions });
  }
  if (groups.embeddedData?.length) {
    grouped.push({
      label: t("common.embedded_data"),
      value: "embeddedData",
      options: groups.embeddedData,
    });
  }
  if (groups.autoCaptured?.length) {
    grouped.push({
      label: t("common.auto_captured"),
      value: "reservedFields",
      options: groups.autoCaptured,
    });
  }

  return grouped;
};

export const getConditionValueOptions = (
  localSurvey: TSurvey,
  t: TFunction,
  blockIdx?: number, // Optional - if provided, includes elements from this block and all previous blocks
  /**
   * Off by default because this picker is shared with the quota condition builder, whose evaluation
   * (`evaluateQuotas`) projects no reserved values — offering them there would let an author write a
   * condition that silently never matches. Survey block logic opts in; see ENG-1840's PR notes.
   */
  includeReservedFields = false
): TComboboxGroupedOption[] => {
  // If blockIdx is provided, get elements from current block and all previous blocks
  // Otherwise, get all elements from all blocks
  const allElements =
    blockIdx === undefined
      ? getElementsFromBlocks(localSurvey.blocks)
      : localSurvey.blocks.slice(0, blockIdx + 1).flatMap((block) => block.elements);

  const elementOptions: TComboboxOption[] = [];

  allElements.forEach((element) => {
    if (element.type === TSurveyElementTypeEnum.Matrix) {
      const elementHeadline = getElementHeadline(localSurvey, element, "default", t);

      // Rows submenu
      const rows = element.rows.map((row, rowIdx) => {
        const processedLabel = recallToHeadline(row.label, localSurvey, false, "default");
        return {
          icon: getElementIconMapping(t)[element.type],
          label: `${getTextContent(processedLabel.default ?? "")} (${elementHeadline})`,
          value: `${element.id}.${rowIdx}`,
          meta: {
            type: "element",
            rowIdx: rowIdx.toString(),
          },
        };
      });

      elementOptions.push({
        icon: getElementIconMapping(t)[element.type],
        label: elementHeadline,
        value: element.id,
        meta: {
          type: "element",
        },
        children: [
          {
            label: t("workspace.surveys.edit.matrix_rows", "Rows"),
            value: `${element.id}-rows`,
            children: rows,
          },
          {
            label: t("workspace.surveys.edit.matrix_all_fields", "All fields"),
            value: element.id,
            meta: {
              type: "element",
            },
          },
        ],
      });
    } else {
      elementOptions.push({
        icon: getElementIconMapping(t)[element.type],
        label: getElementHeadline(localSurvey, element, "default", t),
        value: element.id,
        meta: {
          type: "element",
        },
      });
    }
  });

  return toOperandGroups(t, {
    questions: elementOptions,
    embeddedData: getEmbeddedFieldOptions(localSurvey),
    autoCaptured: includeReservedFields
      ? getPickerReservedEntries(localSurvey).map((entry) => toReservedOption(entry, t))
      : [],
  });
};

export const replaceEndingCardHeadlineRecall = (survey: TSurvey, language: string) => {
  const modifiedSurvey = structuredClone(survey);
  modifiedSurvey.endings.forEach((ending) => {
    if (ending.type === "endScreen") {
      ending.headline = recallToHeadline(ending.headline || {}, modifiedSurvey, false, language);
    }
  });
  return modifiedSurvey;
};

export const getActionObjectiveOptions = (t: TFunction): TComboboxOption[] => [
  { label: t("workspace.surveys.edit.calculate"), value: "calculate" },
  { label: t("workspace.surveys.edit.require_answer"), value: "requireAnswer" },
  { label: t("workspace.surveys.edit.jump_to_block"), value: "jumpToBlock" },
];

export const hasJumpToBlockAction = (actions: TSurveyBlockLogicAction[]): boolean => {
  return actions.some((action) => action.objective === "jumpToBlock");
};

export const getElementOperatorOptions = (
  element: TSurveyElement,
  t: TFunction,
  condition?: TSingleCondition
): TComboboxOption[] => {
  let options: TLogicRuleOption;

  if (element.type === "openText") {
    const inputType = element.inputType === "number" ? "number" : "text";
    options = getLogicRules(t).element[`openText.${inputType}`].options;
  } else if (element.type === TSurveyElementTypeEnum.Matrix && condition) {
    const isMatrixRow =
      condition.leftOperand.type === "element" && condition.leftOperand?.meta?.row !== undefined;
    options = getLogicRules(t).element[`matrix${isMatrixRow ? ".row" : ""}`].options;
  } else {
    options = getLogicRules(t).element[element.type].options;
  }

  if (element.required) {
    options = options.filter((option) => option.value !== "isSkipped") as TLogicRuleOption;
  }

  return options;
};

export const getDefaultOperatorForElement = (
  element: TSurveyElement,
  t: TFunction
): TSurveyLogicConditionsOperator => {
  const options = getElementOperatorOptions(element, t);

  return options[0].value.toString() as TSurveyLogicConditionsOperator;
};

export const getFormatLeftOperandValue = (condition: TSingleCondition, localSurvey: TSurvey): string => {
  if (condition.leftOperand.type === "element") {
    const elements = getElementsFromBlocks(localSurvey.blocks);
    const element = elements.find((e) => e.id === condition.leftOperand.value);
    if (element && element.type === TSurveyElementTypeEnum.Matrix) {
      if (condition.leftOperand?.meta?.row !== undefined) {
        return `${condition.leftOperand.value}.${condition.leftOperand.meta.row}`;
      }
    }
  }
  return condition.leftOperand.value;
};

/**
 * The dataType an operand's value carries, for the `hiddenField` and `reserved` operand types — the
 * two whose operators and right-hand input follow the *field's* declared type rather than an
 * element's answer shape.
 *
 * Both fall back to `string` for a value that resolves to no definition, which is the widest safe
 * set rather than a guess: a condition outlives the thing it points at (a field deleted from the
 * survey, a catalog entry shadowed by a later declaration of the same name), and an operand with no
 * operators at all would strand the author in a row they can neither complete nor understand.
 *
 * The reserved lookup reads the whole catalog rather than {@link getPickerReservedEntries} for that
 * exact reason: the filtered list is what may be *offered*, not what may be *shown*.
 */
const getOperandDataType = (condition: TSingleCondition, localSurvey: TSurvey): TEmbeddedDataType => {
  if (condition.leftOperand.type === "reserved") {
    const entry = RESERVED_FIELD_CATALOG.find((candidate) => candidate.name === condition.leftOperand.value);
    return entry?.dataType ?? "string";
  }

  const field = getSurveyEmbeddedFields(localSurvey).find(
    ({ link }) => link.storageKey === condition.leftOperand.value
  );
  return field?.field.dataType ?? "string";
};

export const getConditionOperatorOptions = (
  condition: TSingleCondition,
  localSurvey: TSurvey,
  t: TFunction
): TComboboxOption[] => {
  if (condition.leftOperand.type === "variable") {
    const variables = getComputedFieldOptions(localSurvey);
    const variableType =
      variables.find((variable) => variable.id === condition.leftOperand.value)?.type || "text";
    return getLogicRules(t)[`variable.${variableType}`].options;
  } else if (condition.leftOperand.type === "hiddenField" || condition.leftOperand.type === "reserved") {
    // One lookup for both, because ENG-1853 gave them one rule: the operators follow the dataType the
    // field declares. A legacy ingested field is a `string` and `field.string` is the exact list the
    // retired `hiddenField` family held, so those conditions keep every operator they had.
    return getLogicRules(t)[`field.${getOperandDataType(condition, localSurvey)}`].options;
  } else if (condition.leftOperand.type === "element") {
    // Derive elements from blocks
    const elements = getElementsFromBlocks(localSurvey.blocks);
    const element = elements.find((element) => {
      let leftOperandElementId = condition.leftOperand.value;
      if (element.type === TSurveyElementTypeEnum.Matrix) {
        leftOperandElementId = condition.leftOperand.value.split(".")[0];
      }
      return element.id === leftOperandElementId;
    });

    if (!element) return [];

    return getElementOperatorOptions(element, t, condition);
  }
  return [];
};

/**
 * The right-hand side of a boolean comparison: the two spellings the value is actually stored as,
 * and no free-text box (ENG-1853).
 *
 * `"true"` / `"false"` are stored strings, not booleans — an ingested boolean field is coerced to
 * that pair on the way in and `projectReservedValues` stringifies a reserved one the same way — so
 * these values compare equal to what the evaluator reads. Typing the word was the only way to write
 * this condition before, and a typo produced a row that read correctly and could never match.
 */
const getBooleanValueProps = (t: TFunction): TConditionValueProps => ({
  show: true,
  showInput: false,
  options: toOperandGroups(t, {
    choices: [
      { label: t("common.true"), value: "true", meta: { type: "static" } },
      { label: t("common.false"), value: "false", meta: { type: "static" } },
    ],
  }),
});

export const getMatchValueProps = (
  condition: TSingleCondition,
  localSurvey: TSurvey,
  t: TFunction,
  blockIdx?: number // Optional - if provided, includes elements from this block and all previous blocks
): TConditionValueProps => {
  if (
    [
      "isAccepted",
      "isBooked",
      "isClicked",
      "isNotClicked",
      "isCompletelySubmitted",
      "isPartiallySubmitted",
      "isSkipped",
      "isSubmitted",
      "isSet",
      "isNotSet",
      "isEmpty",
      "isNotEmpty",
    ].includes(condition.operator)
  ) {
    return { show: false, options: [] };
  }

  // If blockIdx is provided, get elements from current block and all previous blocks
  // Otherwise, get all elements from all blocks
  let elements =
    blockIdx === undefined
      ? getElementsFromBlocks(localSurvey.blocks)
      : localSurvey.blocks
          .slice(0, blockIdx + 1) // Include blocks from 0 to blockIdx (inclusive)
          .flatMap((block) => block.elements);

  const selectedElement = elements.find((element) => element.id === condition.leftOperand.value);

  if (condition.leftOperand.type === "element") {
    elements = elements.filter((element) => element.id !== condition.leftOperand.value);
  }

  // Comparing a field to itself is never a useful condition, so whatever is on the left is dropped
  // from the right — for all three field-ish operand types, which now share one list.
  const embeddedFieldsExcludingSelf = (comparableAs: TEmbeddedDataType): TComboboxOption[] =>
    getEmbeddedFieldOptions(localSurvey, { exclude: condition.leftOperand.value, comparableAs });

  const toElementOption = (element: TSurveyElement): TComboboxOption => ({
    icon: getElementIconMapping(t)[element.type],
    label: getElementHeadline(localSurvey, element, "default", t),
    value: element.id,
    meta: {
      type: "element",
    },
  });

  if (condition.leftOperand.type === "element") {
    if (selectedElement?.type === TSurveyElementTypeEnum.OpenText) {
      const isNumeric = selectedElement.inputType === "number";
      const allowedElementTypes = [TSurveyElementTypeEnum.OpenText];

      if (isNumeric) {
        allowedElementTypes.push(
          TSurveyElementTypeEnum.Rating,
          TSurveyElementTypeEnum.NPS,
          TSurveyElementTypeEnum.CSAT,
          TSurveyElementTypeEnum.CES
        );
      }

      if (["equals", "doesNotEqual"].includes(condition.operator) && !isNumeric) {
        allowedElementTypes.push(
          TSurveyElementTypeEnum.Date,
          TSurveyElementTypeEnum.MultipleChoiceSingle,
          TSurveyElementTypeEnum.MultipleChoiceMulti
        );
      }

      return {
        show: true,
        showInput: true,
        inputType: isNumeric ? "number" : "text",
        options: toOperandGroups(t, {
          questions: elements
            .filter((element) => allowedElementTypes.includes(element.type))
            .map(toElementOption),
          embeddedData: embeddedFieldsExcludingSelf(isNumeric ? "number" : "string"),
        }),
      };
    } else if (
      selectedElement?.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
      selectedElement?.type === TSurveyElementTypeEnum.MultipleChoiceMulti
    ) {
      const operatorsToFilterNone = [
        "includesOneOf",
        "includesAllOf",
        "doesNotIncludeOneOf",
        "doesNotIncludeAllOf",
      ];
      const shouldFilterNone =
        selectedElement.type === TSurveyElementTypeEnum.MultipleChoiceMulti &&
        operatorsToFilterNone.includes(condition.operator);

      const choices = selectedElement.choices
        .filter((choice) => !shouldFilterNone || choice.id !== "none")
        .map((choice) => ({
          label: getLocalizedValue(choice.label, "default"),
          value: choice.id,
          meta: {
            type: "static",
          },
        }));

      return {
        show: true,
        showInput: false,
        options: toOperandGroups(t, { choices }),
      };
    } else if (selectedElement?.type === TSurveyElementTypeEnum.PictureSelection) {
      const choices = selectedElement.choices.map((choice, idx) => ({
        imgSrc: choice.imageUrl,
        label: `${t("common.picture")} ${idx + 1}`,
        value: choice.id,
        meta: {
          type: "static",
        },
      }));

      return {
        show: true,
        showInput: false,
        options: toOperandGroups(t, { choices }),
      };
    } else if (
      selectedElement?.type === TSurveyElementTypeEnum.Rating ||
      selectedElement?.type === TSurveyElementTypeEnum.CSAT ||
      selectedElement?.type === TSurveyElementTypeEnum.CES ||
      selectedElement?.type === TSurveyElementTypeEnum.NPS
    ) {
      // NPS is 0-10; the other three are 1-range.
      const isNps = selectedElement.type === TSurveyElementTypeEnum.NPS;
      const choices = Array.from({ length: isNps ? 11 : selectedElement.range }, (_, idx) => ({
        label: `${isNps ? idx : idx + 1}`,
        value: isNps ? idx : idx + 1,
        meta: {
          type: "static",
        },
      }));

      return {
        show: true,
        showInput: false,
        options: toOperandGroups(t, {
          choices,
          // Computed fields only: a numeric scale has never been comparable against an ingested
          // field, whose value is whatever arrived in the URL.
          embeddedData: getEmbeddedFieldOptions(localSurvey, {
            exclude: condition.leftOperand.value,
            comparableAs: "number",
            source: "computed",
          }),
        }),
      };
    } else if (selectedElement?.type === TSurveyElementTypeEnum.Date) {
      return {
        show: true,
        showInput: true,
        inputType: "date",
        options: toOperandGroups(t, {
          questions: elements
            .filter((element) =>
              [TSurveyElementTypeEnum.OpenText, TSurveyElementTypeEnum.Date].includes(element.type)
            )
            .map(toElementOption),
          embeddedData: embeddedFieldsExcludingSelf("date"),
        }),
      };
    } else if (selectedElement?.type === TSurveyElementTypeEnum.Matrix) {
      const choices = selectedElement.columns.map((column, colIdx) => ({
        label: getLocalizedValue(column.label, "default"),
        value: colIdx.toString(),
        meta: {
          type: "static",
        },
      }));

      return {
        show: true,
        showInput: false,
        options: toOperandGroups(t, { choices }),
      };
    }

    return { show: false, options: [] };
  }

  /*
   * One branch for all three field-ish operands — `variable`, `hiddenField` and `reserved` (ENG-1853).
   * They used to have three near-identical branches that differed only in which groups they built;
   * now they share one list and differ only in the dataType they compare against, which is exactly
   * what {@link getOperandDataType} answers.
   */
  const dataType = getOperandDataType(condition, localSurvey);

  if (dataType === "boolean") return getBooleanValueProps(t);

  /*
   * Only elements that can actually hold this dataType. Without the filter a numeric condition could
   * be pointed at a text answer, and a date one at a rating — selectable, and silently never true.
   */
  const comparableElements = elements.filter((element) => {
    if (dataType === "number") {
      return (
        [
          TSurveyElementTypeEnum.Rating,
          TSurveyElementTypeEnum.NPS,
          TSurveyElementTypeEnum.CSAT,
          TSurveyElementTypeEnum.CES,
        ].includes(element.type) ||
        (element.type === TSurveyElementTypeEnum.OpenText && element.inputType === "number")
      );
    }
    if (dataType === "date") return element.type === TSurveyElementTypeEnum.Date;

    const allowedTextTypes = [TSurveyElementTypeEnum.OpenText, TSurveyElementTypeEnum.MultipleChoiceSingle];
    if (["equals", "doesNotEqual"].includes(condition.operator)) {
      allowedTextTypes.push(TSurveyElementTypeEnum.MultipleChoiceMulti, TSurveyElementTypeEnum.Date);
    }
    return allowedTextTypes.includes(element.type);
  });

  return {
    show: true,
    showInput: true,
    inputType: INPUT_TYPE_BY_DATA_TYPE[dataType],
    options: toOperandGroups(t, {
      questions: comparableElements.map(toElementOption),
      embeddedData: embeddedFieldsExcludingSelf(dataType),
      // Other auto-captured fields of the same dataType are comparable (`source` equals `action`,
      // say), minus the one already on the left. Offered only opposite another auto-captured field,
      // as before: a quota condition projects no reserved values at all.
      autoCaptured:
        condition.leftOperand.type === "reserved"
          ? getPickerReservedEntries(localSurvey)
              .filter(
                (candidate) =>
                  candidate.name !== condition.leftOperand.value && candidate.dataType === dataType
              )
              .map((entry) => toReservedOption(entry, t))
          : [],
    }),
  };
};

export const getActionTargetOptions = (
  action: TSurveyBlockLogicAction,
  localSurvey: TSurvey,
  blockIdx: number,
  t: TFunction
): TComboboxOption[] => {
  // Derive elements from blocks
  const allElements = localSurvey.blocks?.flatMap((b) => b.elements) ?? [];

  // Calculate which elements come after the current block
  let elementsUpToAndIncludingCurrentBlock = 0;
  for (let i = 0; i <= blockIdx; i++) {
    elementsUpToAndIncludingCurrentBlock += localSurvey.blocks[i].elements.length;
  }

  // For requireAnswer, show elements after the current block (not including current block)
  if (action.objective === "requireAnswer") {
    const elementsAfterCurrentBlock = allElements.filter(
      (_, idx) => idx >= elementsUpToAndIncludingCurrentBlock
    );
    const nonRequiredElements = elementsAfterCurrentBlock.filter((element) => !element.required);

    // Return element IDs for requireAnswer
    return nonRequiredElements.map((element) => {
      return {
        icon: getElementIconMapping(t)[element.type],
        label: getElementHeadline(localSurvey, element, "default", t),
        value: element.id,
      };
    });
  }

  // For jumpToBlock, we need block IDs
  const blocks = localSurvey.blocks ?? [];
  const blockOptions: TComboboxOption[] = [];

  // Add blocks after the current block
  for (let i = blockIdx + 1; i < blocks.length; i++) {
    const block = blocks[i];

    blockOptions.push({
      label: getBlockDisplayName(block, i, t),
      value: block.id,
    });
  }

  // Ending cards
  const endingCardOptions = localSurvey.endings.map((ending) => {
    if (ending.type === "endScreen") {
      const processedHeadline = recallToHeadline(
        ending.headline ?? { default: "" },
        localSurvey,
        false,
        "default"
      );
      return {
        label: getTextContent(processedHeadline.default ?? "") || t("workspace.surveys.edit.end_screen_card"),
        value: ending.id,
      };
    } else {
      return {
        label: ending.label || t("workspace.surveys.edit.redirect_thank_you_card"),
        value: ending.id,
      };
    }
  });

  return [...blockOptions, ...endingCardOptions];
};

/**
 * The targets a `calculate` action may assign to: the survey's computed Embedded Data fields, and
 * only those — there is nothing to assign to an ingested field, whose value arrives from outside.
 *
 * Flat rather than grouped for that reason (ENG-1853): one source means one group, and a lone
 * heading over every row says nothing. The rows are labelled by the shared mapping, so a shared
 * field carries its library key here exactly as it does in the condition pickers.
 *
 * `meta.variableType` rather than `meta.type`: this option feeds `getActionOperatorOptions`, which
 * asks what kind of value it is assigning, not what kind of reference it is.
 */
export const getActionVariableOptions = (localSurvey: TSurvey): TComboboxOption[] =>
  getComputedEmbeddedFields(localSurvey).map((embeddedField) => ({
    ...toEmbeddedFieldOption(embeddedField),
    meta: {
      variableType: embeddedField.field.dataType === "number" ? "number" : "text",
      ...(embeddedField.field.key === null ? {} : { hint: embeddedField.field.key }),
    },
  }));

export const getActionOperatorOptions = (
  t: TFunction,
  variableType?: TSurveyVariable["type"]
): TComboboxOption[] => {
  if (variableType === "number") {
    return [
      {
        label: t("workspace.surveys.edit.add"),
        value: "add",
      },
      {
        label: t("workspace.surveys.edit.subtract"),
        value: "subtract",
      },
      {
        label: t("workspace.surveys.edit.multiply"),
        value: "multiply",
      },
      {
        label: t("workspace.surveys.edit.divide"),
        value: "divide",
      },
      {
        label: t("workspace.surveys.edit.assign"),
        value: "assign",
      },
    ];
  } else if (variableType === "text") {
    return [
      {
        label: t("workspace.surveys.edit.assign"),
        value: "assign",
      },
      {
        label: t("workspace.surveys.edit.concat"),
        value: "concat",
      },
    ];
  }
  return [];
};

/**
 * The right-hand side of a `calculate` action. Same grouping as the condition pickers (ENG-1853):
 * Questions, then one Embedded Data group. No auto-captured group — `evaluateLogic` computes these
 * assignments from `responseData` and variables alone, so a reserved value offered here would read
 * as unset every time.
 */
export const getActionValueOptions = (
  variableId: string,
  localSurvey: TSurvey,
  blockIdx: number,
  t: TFunction
): TComboboxGroupedOption[] => {
  // Get elements from current block and all previous blocks
  const allElements = localSurvey.blocks
    .slice(0, blockIdx + 1) // Include blocks from 0 to blockIdx (inclusive)
    .flatMap((block) => block.elements);

  const selectedVariable = getComputedFieldOptions(localSurvey).find(
    (variable) => variable.id === variableId
  );

  if (!selectedVariable) return [];

  const isNumeric = selectedVariable.type === "number";

  const allowedElementTypes = isNumeric
    ? [
        TSurveyElementTypeEnum.Rating,
        TSurveyElementTypeEnum.NPS,
        TSurveyElementTypeEnum.CSAT,
        TSurveyElementTypeEnum.CES,
      ]
    : [
        TSurveyElementTypeEnum.OpenText,
        TSurveyElementTypeEnum.MultipleChoiceSingle,
        TSurveyElementTypeEnum.Rating,
        TSurveyElementTypeEnum.NPS,
        TSurveyElementTypeEnum.CSAT,
        TSurveyElementTypeEnum.CES,
        TSurveyElementTypeEnum.Date,
      ];

  const allowedElements = allElements.filter(
    (element) =>
      allowedElementTypes.includes(element.type) ||
      // A number variable also accepts a numeric open text answer, which is not a type of its own.
      (isNumeric && element.type === TSurveyElementTypeEnum.OpenText && element.inputType === "number")
  );

  return toOperandGroups(t, {
    questions: allowedElements.map((element) => ({
      icon: getElementIconMapping(t)[element.type],
      label: getElementHeadline(localSurvey, element, "default", t),
      value: element.id,
      meta: {
        type: "element",
      },
    })),
    embeddedData: getEmbeddedFieldOptions(localSurvey, {
      exclude: variableId,
      comparableAs: isNumeric ? "number" : "string",
    }),
  });
};

const isUsedInLeftOperand = (
  leftOperand: TLeftOperand,
  type: "element" | "hiddenField" | "variable",
  id: string
): boolean => {
  switch (type) {
    case "element":
      return leftOperand.type === "element" && leftOperand.value === id;
    case "hiddenField":
      return leftOperand.type === "hiddenField" && leftOperand.value === id;
    case "variable":
      return leftOperand.type === "variable" && leftOperand.value === id;
    default:
      return false;
  }
};

const isUsedInRightOperand = (
  rightOperand: TRightOperand,
  type: "element" | "hiddenField" | "variable",
  id: string
): boolean => {
  switch (type) {
    case "element":
      return rightOperand.type === "element" && rightOperand.value === id;
    case "hiddenField":
      return rightOperand.type === "hiddenField" && rightOperand.value === id;
    case "variable":
      return rightOperand.type === "variable" && rightOperand.value === id;
    default:
      return false;
  }
};

export const findElementUsedInLogic = (survey: TSurvey, elementId: string): number => {
  const { block } = findElementLocation(survey, elementId);

  // The parent block for this elementId was not found in the survey, while this shouldn't happen but we still have a safety check and return -1
  if (!block) {
    return -1;
  }

  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand, "element", elementId)) ||
        isUsedInLeftOperand(condition.leftOperand, "element", elementId)
      );
    }
  };

  const isUsedInAction = (action: TSurveyBlockLogicAction): boolean => {
    if (action.objective === "requireAnswer" && action.target === elementId) {
      return true;
    }

    if (
      action.objective === "calculate" &&
      action.value.type === "element" &&
      action.value.value === elementId
    ) {
      return true;
    }

    return action.objective === "jumpToBlock" && action.target === block.id;
  };

  const isUsedInLogicRule = (logicRule: TSurveyBlockLogic): boolean => {
    return isUsedInCondition(logicRule.conditions) || logicRule.actions.some(isUsedInAction);
  };

  const elements = getElementsFromBlocks(survey.blocks);

  return elements.findIndex((element) => {
    const { block } = findElementLocation(survey, element.id);

    if (!block) {
      return false;
    }

    return (
      block.logicFallback === elementId || (element.id !== elementId && block.logic?.some(isUsedInLogicRule))
    );
  });
};

export const findBlockUsedInLogic = (survey: TSurvey, blockId: string): number => {
  const targetBlock = survey.blocks.find((b) => b.id === blockId);
  if (!targetBlock) return -1;

  const isUsedInAction = (action: TSurveyBlockLogicAction): boolean => {
    return action.objective === "jumpToBlock" && action.target === blockId;
  };

  const isUsedInLogicRule = (logicRule: TSurveyBlockLogic): boolean => {
    return logicRule.actions.some(isUsedInAction);
  };

  const elements = getElementsFromBlocks(survey.blocks);

  const blockUsageIndex = elements.findIndex((element) => {
    const { block } = findElementLocation(survey, element.id);

    if (!block) {
      return false;
    }

    return block.id !== blockId && (block.logic?.some(isUsedInLogicRule) || block.logicFallback === blockId);
  });

  if (blockUsageIndex !== -1) {
    return blockUsageIndex;
  }

  // Check if any element in the block is used in logic
  for (const element of targetBlock.elements) {
    const elementUsedIndex = findElementUsedInLogic(survey, element.id);
    if (elementUsedIndex !== -1) {
      return elementUsedIndex;
    }
  }

  return -1;
};

export const isUsedInQuota = (
  quota: TSurveyQuota,
  {
    elementId,
    hiddenFieldId,
    variableId,
    endingCardId,
  }: {
    elementId?: string;
    hiddenFieldId?: string;
    variableId?: string;
    endingCardId?: string;
  }
): boolean => {
  if (elementId) {
    return quota.logic.conditions.some(
      (condition) =>
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand, "element", elementId)) ||
        isUsedInLeftOperand(condition.leftOperand, "element", elementId)
    );
  }

  if (hiddenFieldId) {
    return quota.logic.conditions.some(
      (condition) =>
        (condition.rightOperand &&
          isUsedInRightOperand(condition.rightOperand, "hiddenField", hiddenFieldId)) ||
        isUsedInLeftOperand(condition.leftOperand, "hiddenField", hiddenFieldId)
    );
  }

  if (variableId) {
    return quota.logic.conditions.some(
      (condition) =>
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand, "variable", variableId)) ||
        isUsedInLeftOperand(condition.leftOperand, "variable", variableId)
    );
  }

  if (endingCardId) {
    return quota.action === "endSurvey" && quota.endingCardId === endingCardId;
  }

  return false;
};

const checkTextForRecallPattern = (textObject: TI18nString | undefined, recallPattern: string): boolean => {
  return textObject ? Object.values(textObject).some((text: string) => text.includes(recallPattern)) : false;
};

const checkWelcomeCardForRecall = (welcomeCard: TSurveyWelcomeCard, recallPattern: string): boolean => {
  if (!welcomeCard.enabled) return false;

  return (
    checkTextForRecallPattern(welcomeCard.headline, recallPattern) ||
    checkTextForRecallPattern(welcomeCard.subheader, recallPattern)
  );
};

const checkElementForRecall = (element: TSurveyElement, recallPattern: string): boolean => {
  // Check headline
  if (Object.values(element.headline).some((text) => text.includes(recallPattern))) {
    return true;
  }

  // Check subheader
  if (checkTextForRecallPattern(element.subheader, recallPattern)) {
    return true;
  }

  return false;
};

const checkEndingCardsForRecall = (endings: TSurveyEndings | undefined, recallPattern: string): boolean => {
  if (!endings) return false;

  return endings.some((ending) => {
    if (ending.type === "endScreen") {
      return (
        checkTextForRecallPattern(ending.headline, recallPattern) ||
        checkTextForRecallPattern(ending.subheader, recallPattern)
      );
    }
    return false;
  });
};

export const isUsedInRecall = (survey: TSurvey, id: string): number => {
  const recallPattern = `#recall:${id}/fallback:`;

  // Check welcome card
  if (checkWelcomeCardForRecall(survey.welcomeCard, recallPattern)) {
    return -2; // Special index for welcome card
  }

  const elements = getElementsFromBlocks(survey.blocks);

  const elementIndex = elements.findIndex((element) => checkElementForRecall(element, recallPattern));
  if (elementIndex !== -1) {
    return elementIndex;
  }

  // Check ending cards
  if (checkEndingCardsForRecall(survey.endings, recallPattern)) {
    return elements.length; // Special index for ending cards
  }

  return -1; // Not found
};

/**
 * The index of the first element whose block carries a logic rule the predicate matches, or -1.
 *
 * The "find the element, then look at its block's logic" walk was written out identically in every
 * `find*UsedInLogic` below; only the predicate differs.
 */
const findElementIndexByBlockLogic = (
  survey: TSurvey,
  isUsedInLogicRule: (logicRule: TSurveyBlockLogic) => boolean
): number =>
  getElementsFromBlocks(survey.blocks).findIndex((element) => {
    const { block } = findElementLocation(survey, element.id);
    if (!block) return false;
    return block.logic?.some(isUsedInLogicRule);
  });

export const findOptionUsedInLogic = (
  survey: TSurvey,
  elementId: string,
  optionId: string,
  checkInLeftOperand: boolean = false
): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return isUsedInOperand(condition);
    }
  };

  const isUsedInOperand = (condition: TSingleCondition): boolean => {
    if (condition.leftOperand.type === "element" && condition.leftOperand.value === elementId) {
      if (checkInLeftOperand) {
        if (condition.leftOperand.meta && Object.entries(condition.leftOperand.meta).length > 0) {
          const optionIdInMeta = Object.values(condition.leftOperand.meta).some(
            (metaValue) => metaValue === optionId
          );
          return optionIdInMeta;
        }
      }
      if (!checkInLeftOperand && condition.rightOperand && condition.rightOperand.type === "static") {
        if (Array.isArray(condition.rightOperand.value)) {
          return condition.rightOperand.value.includes(optionId);
        } else {
          return condition.rightOperand.value === optionId;
        }
      }
    }
    return false;
  };

  const isUsedInLogicRule = (logicRule: TSurveyBlockLogic): boolean => {
    return isUsedInCondition(logicRule.conditions);
  };

  return findElementIndexByBlockLogic(survey, isUsedInLogicRule);
};

export const findVariableUsedInLogic = (survey: TSurvey, variableId: string): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand, "variable", variableId)) ||
        isUsedInLeftOperand(condition.leftOperand, "variable", variableId)
      );
    }
  };

  const isUsedInAction = (action: TSurveyBlockLogicAction): boolean => {
    return action.objective === "calculate" && action.variableId === variableId;
  };

  const isUsedInLogicRule = (logicRule: TSurveyBlockLogic): boolean => {
    return isUsedInCondition(logicRule.conditions) || logicRule.actions.some(isUsedInAction);
  };

  return findElementIndexByBlockLogic(survey, isUsedInLogicRule);
};

export const findHiddenFieldUsedInLogic = (survey: TSurvey, hiddenFieldId: string): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand &&
          isUsedInRightOperand(condition.rightOperand, "hiddenField", hiddenFieldId)) ||
        isUsedInLeftOperand(condition.leftOperand, "hiddenField", hiddenFieldId)
      );
    }
  };

  const isUsedInLogicRule = (logicRule: TSurveyBlockLogic): boolean => {
    return isUsedInCondition(logicRule.conditions);
  };

  return findElementIndexByBlockLogic(survey, isUsedInLogicRule);
};

export const getSurveyFollowUpActionDefaultBody = (t: TFunction): string => {
  return t("templates.follow_ups_modal_action_body")
    .replaceAll(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
};

export const findEndingCardUsedInLogic = (survey: TSurvey, endingCardId: string): number => {
  const isUsedInAction = (action: TSurveyBlockLogicAction): boolean => {
    // jumpToBlock can target ending card IDs as well as block IDs
    return action.objective === "jumpToBlock" && action.target === endingCardId;
  };

  const isUsedInLogicRule = (logicRule: TSurveyBlockLogic): boolean => {
    return logicRule.actions.some(isUsedInAction);
  };

  const elements = getElementsFromBlocks(survey.blocks);

  return elements.findIndex((element) => {
    const { block } = findElementLocation(survey, element.id);

    if (!block) {
      return false;
    }

    return block.logicFallback === endingCardId || block.logic?.some(isUsedInLogicRule);
  });
};
