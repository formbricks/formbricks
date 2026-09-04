import { TFunction } from "i18next";
import { EyeOffIcon, FileDigitIcon, FileType2Icon, GlobeIcon } from "lucide-react";
import { HTMLInputTypeAttribute, JSX } from "react";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import {
  RESERVED_FIELD_CATALOG,
  type TReservedFieldCatalogEntry,
  getDeclaredComputedFields,
  getDeclaredEmbeddedFields,
  getDeclaredIngestedStorageKeys,
  listMidSurveyReservedEntries,
  listShadowingNames,
} from "@formbricks/types/embedded-data-resolver";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyQuota } from "@formbricks/types/quota";
import { formatFieldNameToTitleCase } from "@formbricks/types/safe-identifier";
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
import { findElementLocation, getBlockDisplayName } from "@/modules/survey/editor/lib/blocks";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { type TElement, getElementTypes, getTSurveyElementTypeEnumName } from "@/modules/survey/lib/elements";
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
 * ENG-1837: the editor's view of one computed Embedded Data field. The logic builder renders and
 * filters on an id/name/type triple, so the definitions are adapted to that shape once here rather
 * than reshaped at each of the five pickers below.
 *
 * Sourced from `getDeclaredEmbeddedFields`, which derives from the Variables and Hidden Fields cards
 * and ignores the saved rows — in the editor the cards are the live source of truth, and the rows
 * only catch up on save.
 */
interface TComputedFieldOption {
  id: string;
  name: string;
  type: "text" | "number";
}

const getComputedFieldOptions = (localSurvey: TSurvey): TComputedFieldOption[] =>
  getDeclaredComputedFields(localSurvey).map(({ field, link }) => ({
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
  // the value maps by giving them this same list. `getDeclaredEmbeddedFields` rather than the stored
  // rows because this is the editor: its working copy is stale from the first card edit until save.
  listShadowingNames(
    getDeclaredEmbeddedFields(localSurvey),
    getElementsFromBlocks(localSurvey.blocks).map((element) => element.id)
  );

/** The reserved entries this survey may offer mid-survey, already availability- and shadow-filtered. */
const getPickerReservedEntries = (localSurvey: TSurvey): TReservedFieldCatalogEntry[] =>
  listMidSurveyReservedEntries(RESERVED_FIELD_CATALOG, getDeclaredFieldNames(localSurvey));

/**
 * Which HTML input the literal comparison value gets, per reserved dataType. A map rather than a
 * chain of ternaries so it stays exhaustive: adding a dataType is a compile error here instead of
 * silently falling through to a text box. `boolean` is deliberately text — the value is compared as
 * the string "true"/"false" (see `projectReservedValues`).
 */
const INPUT_TYPE_BY_DATA_TYPE: Record<TEmbeddedDataType, HTMLInputTypeAttribute> = {
  string: "text",
  number: "number",
  boolean: "text",
  date: "date",
};

const toReservedOption = (entry: TReservedFieldCatalogEntry): TComboboxOption => ({
  icon: GlobeIcon,
  label: formatFieldNameToTitleCase(entry.name),
  value: entry.name,
  meta: {
    type: "reserved",
  },
});

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
  const hiddenFields = getDeclaredIngestedStorageKeys(localSurvey);
  const variables = getComputedFieldOptions(localSurvey);
  const reservedOptions = includeReservedFields
    ? getPickerReservedEntries(localSurvey).map(toReservedOption)
    : [];

  // If blockIdx is provided, get elements from current block and all previous blocks
  // Otherwise, get all elements from all blocks
  const allElements =
    blockIdx === undefined
      ? getElementsFromBlocks(localSurvey.blocks)
      : localSurvey.blocks.slice(0, blockIdx + 1).flatMap((block) => block.elements);

  const groupedOptions: TComboboxGroupedOption[] = [];
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

  const variableOptions = variables.map((variable) => {
    return {
      icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
      label: variable.name,
      value: variable.id,
      meta: {
        type: "variable",
      },
    };
  });

  const hiddenFieldsOptions = hiddenFields.map((field) => {
    return {
      icon: EyeOffIcon,
      label: field,
      value: field,
      meta: {
        type: "hiddenField",
      },
    };
  });

  if (elementOptions.length > 0) {
    groupedOptions.push({
      label: t("common.questions"),
      value: "elements",
      options: elementOptions,
    });
  }

  if (variableOptions.length > 0) {
    groupedOptions.push({
      label: t("common.variables"),
      value: "variables",
      options: variableOptions,
    });
  }

  if (hiddenFieldsOptions.length > 0) {
    groupedOptions.push({
      label: t("common.hidden_fields"),
      value: "hiddenFields",
      options: hiddenFieldsOptions,
    });
  }

  if (reservedOptions.length > 0) {
    groupedOptions.push({
      label: t("common.survey_data"),
      value: "reservedFields",
      options: reservedOptions,
    });
  }

  return groupedOptions;
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
  } else if (condition.leftOperand.type === "hiddenField") {
    return getLogicRules(t).hiddenField.options;
  } else if (condition.leftOperand.type === "reserved") {
    // Read off the whole catalog, not the picker's filtered list: a condition can outlive the entry
    // being offered (the survey later declares a field of the same name), and an operand with no
    // operators at all would strand the author in a broken row. Unknown names fall back to string,
    // which is the widest safe set.
    const entry = RESERVED_FIELD_CATALOG.find((candidate) => candidate.name === condition.leftOperand.value);
    const dataType = entry?.dataType ?? "string";
    return getLogicRules(t)[`reserved.${dataType}`].options;
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

export const getMatchValueProps = (
  condition: TSingleCondition,
  localSurvey: TSurvey,
  t: TFunction,
  blockIdx?: number // Optional - if provided, includes elements from this block and all previous blocks
): {
  show?: boolean;
  showInput?: boolean;
  inputType?: HTMLInputTypeAttribute;
  options: TComboboxGroupedOption[];
} => {
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

  let variables = getComputedFieldOptions(localSurvey);
  let hiddenFields = getDeclaredIngestedStorageKeys(localSurvey);

  const selectedElement = elements.find((element) => element.id === condition.leftOperand.value);
  const selectedVariable = variables.find((variable) => variable.id === condition.leftOperand.value);

  if (condition.leftOperand.type === "element") {
    elements = elements.filter((element) => element.id !== condition.leftOperand.value);
  } else if (condition.leftOperand.type === "variable") {
    variables = variables.filter((variable) => variable.id !== condition.leftOperand.value);
  } else if (condition.leftOperand.type === "hiddenField") {
    hiddenFields = hiddenFields.filter((field) => field !== condition.leftOperand.value);
  }

  if (condition.leftOperand.type === "element") {
    if (selectedElement?.type === TSurveyElementTypeEnum.OpenText) {
      const allowedElementTypes = [TSurveyElementTypeEnum.OpenText];

      if (selectedElement.inputType === "number") {
        allowedElementTypes.push(
          TSurveyElementTypeEnum.Rating,
          TSurveyElementTypeEnum.NPS,
          TSurveyElementTypeEnum.CSAT,
          TSurveyElementTypeEnum.CES
        );
      }

      if (["equals", "doesNotEqual"].includes(condition.operator)) {
        if (selectedElement.inputType !== "number") {
          allowedElementTypes.push(
            TSurveyElementTypeEnum.Date,
            TSurveyElementTypeEnum.MultipleChoiceSingle,
            TSurveyElementTypeEnum.MultipleChoiceMulti
          );
        }
      }

      const allowedElements = elements.filter((element) => allowedElementTypes.includes(element.type));

      const elementOptions = allowedElements.map((element) => {
        return {
          icon: getElementIconMapping(t)[element.type],
          label: getTextContent(
            recallToHeadline(element.headline, localSurvey, false, "default").default ?? ""
          ),
          value: element.id,
          meta: {
            type: "element",
          },
        };
      });

      const variableOptions = variables
        .filter((variable) =>
          selectedElement.inputType === "number" ? variable.type === "number" : variable.type === "text"
        )
        .map((variable) => {
          return {
            icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
            label: variable.name,
            value: variable.id,
            meta: {
              type: "variable",
            },
          };
        });

      const hiddenFieldsOptions = hiddenFields.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (elementOptions.length > 0) {
        groupedOptions.push({
          label: t("common.questions"),
          value: "elements",
          options: elementOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: t("common.hidden_fields"),
          value: "hiddenFields",
          options: hiddenFieldsOptions,
        });
      }
      return {
        show: true,
        showInput: true,
        inputType: selectedElement.inputType === "number" ? "number" : "text",
        options: groupedOptions,
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
        .map((choice) => {
          return {
            label: getLocalizedValue(choice.label, "default"),
            value: choice.id,
            meta: {
              type: "static",
            },
          };
        });

      return {
        show: true,
        showInput: false,
        options: [{ label: t("common.choices"), value: "choices", options: choices }],
      };
    } else if (selectedElement?.type === TSurveyElementTypeEnum.PictureSelection) {
      const choices = selectedElement.choices.map((choice, idx) => {
        return {
          imgSrc: choice.imageUrl,
          label: `${t("common.picture")} ${idx + 1}`,
          value: choice.id,
          meta: {
            type: "static",
          },
        };
      });

      return {
        show: true,
        showInput: false,
        options: [{ label: t("common.choices"), value: "choices", options: choices }],
      };
    } else if (
      selectedElement?.type === TSurveyElementTypeEnum.Rating ||
      selectedElement?.type === TSurveyElementTypeEnum.CSAT ||
      selectedElement?.type === TSurveyElementTypeEnum.CES
    ) {
      const choices = Array.from({ length: selectedElement.range }, (_, idx) => {
        return {
          label: `${idx + 1}`,
          value: idx + 1,
          meta: {
            type: "static",
          },
        };
      });

      const numberVariables = variables.filter((variable) => variable.type === "number");

      const variableOptions = numberVariables.map((variable) => {
        return {
          icon: FileDigitIcon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (choices.length > 0) {
        groupedOptions.push({
          label: t("common.choices"),
          value: "choices",
          options: choices,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      return {
        show: true,
        showInput: false,
        options: groupedOptions,
      };
    } else if (selectedElement?.type === TSurveyElementTypeEnum.NPS) {
      const choices = Array.from({ length: 11 }, (_, idx) => {
        return {
          label: `${idx}`,
          value: idx,
          meta: {
            type: "static",
          },
        };
      });

      const numberVariables = variables.filter((variable) => variable.type === "number");

      const variableOptions = numberVariables.map((variable) => {
        return {
          icon: FileDigitIcon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (choices.length > 0) {
        groupedOptions.push({
          label: t("common.choices"),
          value: "choices",
          options: choices,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      return {
        show: true,
        showInput: false,
        options: groupedOptions,
      };
    } else if (selectedElement?.type === TSurveyElementTypeEnum.Date) {
      const openTextElements = elements.filter((element) =>
        [TSurveyElementTypeEnum.OpenText, TSurveyElementTypeEnum.Date].includes(element.type)
      );

      const elementOptions = openTextElements.map((element) => {
        return {
          icon: getElementIconMapping(t)[element.type],
          label: getTextContent(
            recallToHeadline(element.headline, localSurvey, false, "default").default ?? ""
          ),
          value: element.id,
          meta: {
            type: "element",
          },
        };
      });

      const stringVariables = variables.filter((variable) => variable.type === "text");

      const variableOptions = stringVariables.map((variable) => {
        return {
          icon: FileType2Icon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const hiddenFieldsOptions = hiddenFields.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (elementOptions.length > 0) {
        groupedOptions.push({
          label: t("common.questions"),
          value: "elements",
          options: elementOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: t("common.hidden_fields"),
          value: "hiddenFields",
          options: hiddenFieldsOptions,
        });
      }

      return {
        show: true,
        showInput: true,
        inputType: "date",
        options: groupedOptions,
      };
    } else if (selectedElement?.type === TSurveyElementTypeEnum.Matrix) {
      const choices = selectedElement.columns.map((column, colIdx) => {
        return {
          label: getLocalizedValue(column.label, "default"),
          value: colIdx.toString(),
          meta: {
            type: "static",
          },
        };
      });

      return {
        show: true,
        showInput: false,
        options: [{ label: t("common.choices"), value: "choices", options: choices }],
      };
    }
  } else if (condition.leftOperand.type === "variable") {
    if (selectedVariable?.type === "text") {
      const allowedElementTypes = [
        TSurveyElementTypeEnum.OpenText,
        TSurveyElementTypeEnum.MultipleChoiceSingle,
      ];

      if (["equals", "doesNotEqual"].includes(condition.operator)) {
        allowedElementTypes.push(TSurveyElementTypeEnum.MultipleChoiceMulti, TSurveyElementTypeEnum.Date);
      }

      const allowedElements = elements.filter((element) => allowedElementTypes.includes(element.type));

      const elementOptions = allowedElements.map((element) => {
        return {
          icon: getElementIconMapping(t)[element.type],
          label: getElementHeadline(localSurvey, element, "default", t),
          value: element.id,
          meta: {
            type: "element",
          },
        };
      });

      const stringVariables = variables.filter((variable) => variable.type === "text");

      const variableOptions = stringVariables.map((variable) => {
        return {
          icon: FileType2Icon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const hiddenFieldsOptions = hiddenFields.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (elementOptions.length > 0) {
        groupedOptions.push({
          label: t("common.questions"),
          value: "elements",
          options: elementOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: t("common.hidden_fields"),
          value: "hiddenFields",
          options: hiddenFieldsOptions,
        });
      }

      return {
        show: true,
        showInput: true,
        inputType: "text",
        options: groupedOptions,
      };
    } else if (selectedVariable?.type === "number") {
      const allowedElements = elements.filter(
        (element) =>
          [
            TSurveyElementTypeEnum.Rating,
            TSurveyElementTypeEnum.NPS,
            TSurveyElementTypeEnum.CSAT,
            TSurveyElementTypeEnum.CES,
          ].includes(element.type) ||
          (element.type === TSurveyElementTypeEnum.OpenText && element.inputType === "number")
      );

      const elementOptions = allowedElements.map((element) => {
        return {
          icon: getElementIconMapping(t)[element.type],
          label: getElementHeadline(localSurvey, element, "default", t),
          value: element.id,
          meta: {
            type: "element",
          },
        };
      });

      const numberVariables = variables.filter((variable) => variable.type === "number");

      const variableOptions = numberVariables.map((variable) => {
        return {
          icon: FileDigitIcon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const hiddenFieldsOptions = hiddenFields.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (elementOptions.length > 0) {
        groupedOptions.push({
          label: t("common.questions"),
          value: "elements",
          options: elementOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: t("common.hidden_fields"),
          value: "hiddenFields",
          options: hiddenFieldsOptions,
        });
      }

      return {
        show: true,
        showInput: true,
        inputType: "number",
        options: groupedOptions,
      };
    }
  } else if (condition.leftOperand.type === "hiddenField") {
    const allowedElementTypes = [
      TSurveyElementTypeEnum.OpenText,
      TSurveyElementTypeEnum.MultipleChoiceSingle,
    ];

    if (["equals", "doesNotEqual"].includes(condition.operator)) {
      allowedElementTypes.push(TSurveyElementTypeEnum.MultipleChoiceMulti, TSurveyElementTypeEnum.Date);
    }

    const allowedElements = elements.filter((element) => allowedElementTypes.includes(element.type));

    const elementOptions = allowedElements.map((element) => {
      return {
        icon: getElementIconMapping(t)[element.type],
        label: getElementHeadline(localSurvey, element, "default", t),
        value: element.id,
        meta: {
          type: "element",
        },
      };
    });

    const variableOptions = variables
      .filter((variable) => variable.type === "text")
      .map((variable) => {
        return {
          icon: FileType2Icon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

    const hiddenFieldsOptions = hiddenFields.map((field) => {
      return {
        icon: EyeOffIcon,
        label: field,
        value: field,
        meta: {
          type: "hiddenField",
        },
      };
    });

    const groupedOptions: TComboboxGroupedOption[] = [];

    if (elementOptions.length > 0) {
      groupedOptions.push({
        label: t("common.questions"),
        value: "elements",
        options: elementOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: t("common.variables"),
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: t("common.hidden_fields"),
        value: "hiddenFields",
        options: hiddenFieldsOptions,
      });
    }

    return {
      show: true,
      showInput: true,
      inputType: "text",
      options: groupedOptions,
    };
  } else if (condition.leftOperand.type === "reserved") {
    // Without this branch a reserved condition falls through to `{ show: false }` and renders with no
    // right-hand side at all — an operator the author can never complete.
    const entry = RESERVED_FIELD_CATALOG.find((candidate) => candidate.name === condition.leftOperand.value);
    const dataType = entry?.dataType ?? "string";
    const inputType = INPUT_TYPE_BY_DATA_TYPE[dataType];

    /*
     * Only operands that can actually hold this field's dataType. Without the filter a
     * `reserved.number` condition could be pointed at a text variable, and a `reserved.date` one at a
     * numeric answer — selectable, and silently never true. The per-type rules mirror the element and
     * variable branches above. Hidden fields stay in every list because they are untyped strings,
     * exactly as they do for a number variable.
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
      // No element type answers with a boolean, so a boolean reserved field has no comparable answer.
      if (dataType === "boolean") return false;

      const allowedTextTypes = [TSurveyElementTypeEnum.OpenText, TSurveyElementTypeEnum.MultipleChoiceSingle];
      if (["equals", "doesNotEqual"].includes(condition.operator)) {
        allowedTextTypes.push(TSurveyElementTypeEnum.MultipleChoiceMulti, TSurveyElementTypeEnum.Date);
      }
      return allowedTextTypes.includes(element.type);
    });

    // Variables are only ever text or number, so date and boolean reserved fields have none to offer.
    const comparableVariables = variables.filter((variable) => {
      if (dataType === "number") return variable.type === "number";
      if (dataType === "string") return variable.type === "text";
      return false;
    });

    const elementOptions = comparableElements.map((element) => ({
      icon: getElementIconMapping(t)[element.type],
      label: getElementHeadline(localSurvey, element, "default", t),
      value: element.id,
      meta: { type: "element" },
    }));

    const variableOptions = comparableVariables.map((variable) => ({
      icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
      label: variable.name,
      value: variable.id,
      meta: { type: "variable" },
    }));

    const hiddenFieldsOptions = hiddenFields.map((field) => ({
      icon: EyeOffIcon,
      label: field,
      value: field,
      meta: { type: "hiddenField" },
    }));

    // Other reserved entries of the SAME dataType are comparable (`source` equals `action`, say),
    // minus the one already on the left — comparing a field to itself is never a useful condition.
    const reservedOptions = getPickerReservedEntries(localSurvey)
      .filter(
        (candidate) => candidate.name !== condition.leftOperand.value && candidate.dataType === dataType
      )
      .map(toReservedOption);

    const groupedOptions: TComboboxGroupedOption[] = [];

    if (elementOptions.length > 0) {
      groupedOptions.push({
        label: t("common.questions"),
        value: "elements",
        options: elementOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: t("common.variables"),
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: t("common.hidden_fields"),
        value: "hiddenFields",
        options: hiddenFieldsOptions,
      });
    }

    if (reservedOptions.length > 0) {
      groupedOptions.push({
        label: t("common.survey_data"),
        value: "reservedFields",
        options: reservedOptions,
      });
    }

    return {
      show: true,
      showInput: true,
      inputType,
      options: groupedOptions,
    };
  }

  return { show: false, options: [] };
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

export const getActionVariableOptions = (localSurvey: TSurvey): TComboboxOption[] => {
  const variables = getComputedFieldOptions(localSurvey);

  return variables.map((variable) => {
    return {
      icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
      label: variable.name,
      value: variable.id,
      meta: {
        variableType: variable.type,
      },
    };
  });
};

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
  const hiddenFields = getDeclaredIngestedStorageKeys(localSurvey);
  let variables = getComputedFieldOptions(localSurvey);

  const hiddenFieldsOptions = hiddenFields.map((field) => {
    return {
      icon: EyeOffIcon,
      label: field,
      value: field,
      meta: {
        type: "hiddenField",
      },
    };
  });

  const selectedVariable = variables.find((variable) => variable.id === variableId);

  variables = variables.filter((variable) => variable.id !== variableId);

  if (!selectedVariable) return [];

  if (selectedVariable.type === "text") {
    const allowedElements = allElements.filter((element) =>
      [
        TSurveyElementTypeEnum.OpenText,
        TSurveyElementTypeEnum.MultipleChoiceSingle,
        TSurveyElementTypeEnum.Rating,
        TSurveyElementTypeEnum.NPS,
        TSurveyElementTypeEnum.CSAT,
        TSurveyElementTypeEnum.CES,
        TSurveyElementTypeEnum.Date,
      ].includes(element.type)
    );

    const elementOptions = allowedElements.map((element) => {
      return {
        icon: getElementIconMapping(t)[element.type],
        label: getElementHeadline(localSurvey, element, "default", t),
        value: element.id,
        meta: {
          type: "element",
        },
      };
    });

    const stringVariables = variables.filter((variable) => variable.type === "text");

    const variableOptions = stringVariables.map((variable) => {
      return {
        icon: FileType2Icon,
        label: variable.name,
        value: variable.id,
        meta: {
          type: "variable",
        },
      };
    });

    const groupedOptions: TComboboxGroupedOption[] = [];

    if (elementOptions.length > 0) {
      groupedOptions.push({
        label: t("common.questions"),
        value: "elements",
        options: elementOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: t("common.variables"),
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: t("common.hidden_fields"),
        value: "hiddenFields",
        options: hiddenFieldsOptions,
      });
    }

    return groupedOptions;
  } else if (selectedVariable.type === "number") {
    const allowedElements = allElements.filter(
      (element) =>
        [
          TSurveyElementTypeEnum.Rating,
          TSurveyElementTypeEnum.NPS,
          TSurveyElementTypeEnum.CSAT,
          TSurveyElementTypeEnum.CES,
        ].includes(element.type) ||
        (element.type === TSurveyElementTypeEnum.OpenText && element.inputType === "number")
    );

    const elementOptions = allowedElements.map((element) => {
      return {
        icon: getElementIconMapping(t)[element.type],
        label: getTextContent(getLocalizedValue(element.headline, "default")),
        value: element.id,
        meta: {
          type: "element",
        },
      };
    });

    const numberVariables = variables.filter((variable) => variable.type === "number");

    const variableOptions = numberVariables.map((variable) => {
      return {
        icon: FileDigitIcon,
        label: variable.name,
        value: variable.id,
        meta: {
          type: "variable",
        },
      };
    });

    const groupedOptions: TComboboxGroupedOption[] = [];

    if (elementOptions.length > 0) {
      groupedOptions.push({
        label: t("common.questions"),
        value: "elements",
        options: elementOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: t("common.variables"),
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: t("common.hidden_fields"),
        value: "hiddenFields",
        options: hiddenFieldsOptions,
      });
    }

    return groupedOptions;
  }

  return [];
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

  const elements = getElementsFromBlocks(survey.blocks);

  return elements.findIndex((element) => {
    const { block } = findElementLocation(survey, element.id);

    if (!block) {
      return false;
    }

    return block.logic?.some(isUsedInLogicRule);
  });
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

  const elements = survey.blocks.flatMap((b) => b.elements);

  return elements.findIndex((element) => {
    const { block } = findElementLocation(survey, element.id);

    if (!block) {
      return false;
    }

    return block.logic?.some(isUsedInLogicRule);
  });
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

  const elements = getElementsFromBlocks(survey.blocks);

  return elements.findIndex((element) => {
    const { block } = findElementLocation(survey, element.id);

    if (!block) {
      return false;
    }

    return block.logic?.some(isUsedInLogicRule);
  });
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
