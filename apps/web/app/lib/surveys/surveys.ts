import { TFunction } from "i18next";
import { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import {
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
} from "@formbricks/types/embedded-data-resolver";
import { TSurveyQuota } from "@formbricks/types/quota";
import {
  TResponseFilterCriteria,
  TResponseHiddenFieldsFilter,
  TSurveyContactAttributes,
  TSurveyMetaFieldFilter,
} from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TTag } from "@formbricks/types/tags";
import {
  DateRange,
  FilterValue,
  SelectedFilterValue,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import {
  ElementOption,
  ElementOptions,
  OptionsType,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/ElementsComboBox";
import { ElementFilterOptions } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/ResponseFilter";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getReservedFilterEntries } from "@/lib/response/utils";
import { recallToHeadline } from "@/lib/utils/recall";
import { getReservedFieldLabel } from "@/modules/analysis/lib/reserved-field-display";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

const conditionOptions: Record<string, string[]> = {
  openText: ["is"],
  multipleChoiceSingle: ["Includes either"],
  multipleChoiceMulti: ["Includes all", "Includes either"],
  nps: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped", "Includes either"],
  rating: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped"],
  csat: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped"],
  ces: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped"],
  cta: ["is"],
  tags: ["is"],
  languages: ["Equals", "Not equals"],
  pictureSelection: ["Includes all", "Includes either"],
  userAttributes: ["Equals", "Not equals"],
  consent: ["is"],
  matrix: [""],
  address: ["is"],
  contactInfo: ["is"],
  ranking: ["is"],
};
const filterOptions: Record<string, string[]> = {
  openText: ["Filled out", "Skipped"],
  rating: ["1", "2", "3", "4", "5"],
  nps: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  csat: ["1", "2", "3", "4", "5"],
  ces: ["1", "2", "3", "4", "5", "6", "7"],
  cta: ["Clicked", "Dismissed"],
  tags: ["Applied", "Not applied"],
  consent: ["Accepted", "Dismissed"],
  address: ["Filled out", "Skipped"],
  contactInfo: ["Filled out", "Skipped"],
  ranking: ["Filled out", "Skipped"],
};

// Helper function to get filter options for a specific element type
const getElementFilterOption = (
  element: ReturnType<typeof getElementsFromBlocks>[number]
): ElementFilterOptions | null => {
  if (!Object.keys(conditionOptions).includes(element.type)) {
    return null;
  }

  const baseOption = {
    type: element.type,
    filterOptions: conditionOptions[element.type],
    id: element.id,
  };

  switch (element.type) {
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      return {
        ...baseOption,
        filterComboBoxOptions: element.choices?.map((c) => c.label) ?? [""],
      };
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return {
        ...baseOption,
        filterComboBoxOptions: element.choices?.filter((c) => c.id !== "other").map((c) => c.label) ?? [""],
      };
    case TSurveyElementTypeEnum.PictureSelection:
      return {
        ...baseOption,
        filterComboBoxOptions: element.choices?.map((_, idx) => `Picture ${idx + 1}`) ?? [""],
      };
    case TSurveyElementTypeEnum.Matrix:
      return {
        type: element.type,
        filterOptions: element.rows.map((row) => getLocalizedValue(row.label, "default")),
        filterComboBoxOptions: element.columns.map((column) => getLocalizedValue(column.label, "default")),
        id: element.id,
      };
    default:
      return {
        ...baseOption,
        filterComboBoxOptions: filterOptions[element.type],
      };
  }
};

// URL/meta text operators mapping
const META_OP_MAP = {
  Equals: "equals",
  "Not equals": "notEquals",
  Contains: "contains",
  "Does not contain": "doesNotContain",
  "Starts with": "startsWith",
  "Does not start with": "doesNotStartWith",
  "Ends with": "endsWith",
  "Does not end with": "doesNotEndWith",
} as const;

/** Operators that take no right-hand value; rows carrying them must survive the empty-value cleanup. */
export const NO_VALUE_FILTER_OPERATORS = ["Is set", "Is not set"];

// Operator menus per Embedded Data / reserved field dataType (ENG-1848) — the editor's
// logic-builder model: string → equality + text ops, number → comparisons, date → before/after,
// boolean → equality; every family can also match on absence.
const TEXT_FIELD_OPERATORS = [...Object.keys(META_OP_MAP), ...NO_VALUE_FILTER_OPERATORS];
const NUMBER_FIELD_OPERATORS = [
  "Equals",
  "Not equals",
  "Is greater than",
  "Is less than",
  ...NO_VALUE_FILTER_OPERATORS,
];
const DATE_FIELD_OPERATORS = ["Equals", "Not equals", "Is before", "Is after", ...NO_VALUE_FILTER_OPERATORS];
const BOOLEAN_FIELD_OPERATORS = ["Equals", "Not equals", ...NO_VALUE_FILTER_OPERATORS];

const getTypedFieldOperators = (dataType: TEmbeddedDataType): string[] => {
  switch (dataType) {
    case "number":
      return NUMBER_FIELD_OPERATORS;
    case "date":
      return DATE_FIELD_OPERATORS;
    case "boolean":
      return BOOLEAN_FIELD_OPERATORS;
    default:
      return TEXT_FIELD_OPERATORS;
  }
};

// Operator label → criteria op for the typed field groups. "Is before"/"Is after" reuse the
// comparison ops: jsonb compares same-format ISO strings lexicographically, i.e. chronologically.
const TYPED_FIELD_OP_MAP: Record<string, string> = {
  ...META_OP_MAP,
  "Is greater than": "greaterThan",
  "Is less than": "lessThan",
  "Is before": "lessThan",
  "Is after": "greaterThan",
  "Is set": "isSet",
  "Is not set": "isNotSet",
};

type TTypedFieldFilterCondition = NonNullable<TResponseFilterCriteria["reserved"]>[string];

/**
 * One filter row → one typed condition, coerced to the field's dataType (a number field must send a
 * real number — a string-typed `equals` never matches a jsonb number). Returns null when the row
 * cannot form a valid condition, so half-filled rows drop instead of matching wrongly.
 */
const buildTypedFieldCondition = (
  filterType: FilterValue["filterType"],
  dataType: TEmbeddedDataType
): TTypedFieldFilterCondition | null => {
  const op = TYPED_FIELD_OP_MAP[filterType.filterValue ?? ""];
  if (!op) return null;
  if (op === "isSet" || op === "isNotSet") return { op };

  const raw = Array.isArray(filterType.filterComboBoxValue)
    ? filterType.filterComboBoxValue[0]
    : filterType.filterComboBoxValue;
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const value = raw.trim();

  if (dataType === "number") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return { op, value: numeric } as TTypedFieldFilterCondition;
  }
  if (dataType === "boolean") {
    if (op !== "equals" && op !== "notEquals") return null;
    return { op, value: value === "true" } as TTypedFieldFilterCondition;
  }
  return { op, value } as TTypedFieldFilterCondition;
};

export const generateElementAndFilterOptions = ({
  survey,
  environmentTags,
  attributes,
  reservedValues,
  hiddenFields,
  variableValues,
  quotas,
  t,
}: {
  survey: TSurvey;
  environmentTags: TTag[] | undefined;
  attributes: TSurveyContactAttributes;
  reservedValues: TSurveyMetaFieldFilter;
  hiddenFields: TResponseHiddenFieldsFilter;
  variableValues: TSurveyMetaFieldFilter;
  quotas: TSurveyQuota[];
  t: TFunction;
}): {
  elementOptions: ElementOptions[];
  elementFilterOptions: ElementFilterOptions[];
} => {
  let elementOptions: ElementOptions[] = [];
  let elementFilterOptions: ElementFilterOptions[] = [];
  let elementsOptions: ElementOption[] = [];

  const elements = getElementsFromBlocks(survey.blocks);

  elements.forEach((q) => {
    if (Object.keys(conditionOptions).includes(q.type)) {
      elementsOptions.push({
        label: getTextContent(
          getLocalizedValue(recallToHeadline(q.headline, survey, false, "default"), "default")
        ),
        elementType: q.type,
        type: OptionsType.ELEMENTS,
        id: q.id,
      });
    }
  });
  elementOptions = [...elementOptions, { header: OptionsType.ELEMENTS, option: elementsOptions }];
  elements.forEach((q) => {
    const filterOption = getElementFilterOption(q);
    if (filterOption) {
      elementFilterOptions.push(filterOption);
    }
  });

  const tagsOptions = environmentTags?.map((t) => {
    return { label: t.name, type: OptionsType.TAGS, id: t.id };
  });
  if (tagsOptions && tagsOptions?.length > 0) {
    elementOptions = [...elementOptions, { header: OptionsType.TAGS, option: tagsOptions }];
    environmentTags?.forEach((t) => {
      elementFilterOptions.push({
        type: "Tags",
        filterOptions: conditionOptions.tags,
        filterComboBoxOptions: filterOptions.tags,
        id: t.id,
      });
    });
  }

  if (attributes) {
    elementOptions = [
      ...elementOptions,
      {
        header: OptionsType.ATTRIBUTES,
        option: Object.keys(attributes).map((a) => {
          return { label: a, type: OptionsType.ATTRIBUTES, id: a };
        }),
      },
    ];
    Object.keys(attributes).forEach((a) => {
      elementFilterOptions.push({
        type: "Attributes",
        filterOptions: conditionOptions.userAttributes,
        filterComboBoxOptions: attributes[a],
        id: a,
      });
    });
  }

  // Reserved fields, catalog-driven (ENG-1848): the same per-survey list the response table shows
  // (shadowed / anonymized / uncaptured entries gated out by getReservedFilterEntries), with the
  // table's localized labels and operators per dataType — no longer whatever meta keys the stored
  // responses happened to hold.
  const reservedEntries = getReservedFilterEntries(survey);
  if (reservedEntries.length > 0) {
    elementOptions = [
      ...elementOptions,
      {
        header: OptionsType.META,
        option: reservedEntries.map((entry) => {
          return { label: getReservedFieldLabel(entry.name, t), type: OptionsType.META, id: entry.name };
        }),
      },
    ];
    reservedEntries.forEach((entry) => {
      elementFilterOptions.push({
        type: "Meta",
        filterOptions: getTypedFieldOperators(entry.dataType),
        filterComboBoxOptions: reservedValues[entry.name] ?? [],
        fieldDataType: entry.dataType,
        id: entry.name,
      });
    });
  }

  // Ingested embedded fields enumerate from the survey's rows, not from observed response values —
  // a declared field is filterable before its first response. Values live at data[storageKey].
  const ingestedFields = getIngestedEmbeddedFields(survey);
  if (ingestedFields.length > 0) {
    elementOptions = [
      ...elementOptions,
      {
        header: OptionsType.HIDDEN_FIELDS,
        option: ingestedFields.map(({ field, link }) => {
          return { label: field.name, type: OptionsType.HIDDEN_FIELDS, id: link.storageKey };
        }),
      },
    ];
    ingestedFields.forEach(({ field, link }) => {
      elementFilterOptions.push({
        type: "Hidden Fields",
        filterOptions: getTypedFieldOperators(field.dataType),
        filterComboBoxOptions:
          field.dataType === "boolean" ? ["true", "false"] : (hiddenFields[link.storageKey] ?? []),
        fieldDataType: field.dataType,
        id: link.storageKey,
      });
    });
  }

  // Computed embedded fields (variables), keyed by storageKey (ENG-1848).
  const computedFields = getComputedEmbeddedFields(survey);
  if (computedFields.length > 0) {
    elementOptions = [
      ...elementOptions,
      {
        header: OptionsType.VARIABLES,
        option: computedFields.map(({ field, link }) => {
          return { label: field.name, type: OptionsType.VARIABLES, id: link.storageKey };
        }),
      },
    ];
    computedFields.forEach(({ field, link }) => {
      elementFilterOptions.push({
        type: "Variables",
        filterOptions: getTypedFieldOperators(field.dataType),
        filterComboBoxOptions:
          field.dataType === "boolean" ? ["true", "false"] : (variableValues[link.storageKey] ?? []),
        fieldDataType: field.dataType,
        id: link.storageKey,
      });
    });
  }

  let languageElement: ElementOption[] = [];

  //can be extended to include more properties
  if (survey.languages?.length > 0) {
    languageElement.push({ label: "Language", type: OptionsType.OTHERS, id: "language" });
    const languageOptions = survey.languages.map((sl) => sl.language.code);
    elementFilterOptions.push({
      type: OptionsType.OTHERS,
      filterOptions: conditionOptions.languages,
      filterComboBoxOptions: languageOptions,
      id: "language",
    });
  }
  elementOptions = [...elementOptions, { header: OptionsType.OTHERS, option: languageElement }];

  if (quotas.length > 0) {
    const quotaOptions = quotas.map((quota) => {
      return { label: quota.name, type: OptionsType.QUOTAS, id: quota.id };
    });
    elementOptions = [...elementOptions, { header: OptionsType.QUOTAS, option: quotaOptions }];

    quotas.forEach((quota) => {
      elementFilterOptions.push({
        type: "Quotas",
        filterOptions: ["Status"],
        filterComboBoxOptions: ["Screened in", "Screened out (overquota)", "Not in quota"],
        id: quota.id,
      });
    });
  }

  return { elementOptions: [...elementOptions], elementFilterOptions: [...elementFilterOptions] };
};

// Helper function to process filled out/skipped filters
const processFilledOutSkippedFilter = (
  filterType: FilterValue["filterType"],
  elementId: string,
  filters: TResponseFilterCriteria
) => {
  if (filterType.filterComboBoxValue === "Filled out") {
    filters.data![elementId] = { op: "filledOut" };
  } else if (filterType.filterComboBoxValue === "Skipped") {
    filters.data![elementId] = { op: "skipped" };
  }
};

// Helper function to process ranking filters
const processRankingFilter = (
  filterType: FilterValue["filterType"],
  elementId: string,
  filters: TResponseFilterCriteria
) => {
  if (filterType.filterComboBoxValue === "Filled out") {
    filters.data![elementId] = { op: "submitted" };
  } else if (filterType.filterComboBoxValue === "Skipped") {
    filters.data![elementId] = { op: "skipped" };
  }
};

// Helper function to process multiple choice filters
const processMultipleChoiceFilter = (
  filterType: FilterValue["filterType"],
  elementId: string,
  filters: TResponseFilterCriteria
) => {
  if (filterType.filterValue === "Includes either") {
    filters.data![elementId] = {
      op: "includesOne",
      value: filterType.filterComboBoxValue as string[],
    };
  } else if (filterType.filterValue === "Includes all") {
    filters.data![elementId] = {
      op: "includesAll",
      value: filterType.filterComboBoxValue as string[],
    };
  }
};

// Helper function to process NPS/Rating filters
const processNPSRatingFilter = (
  filterType: FilterValue["filterType"],
  elementId: string,
  filters: TResponseFilterCriteria
) => {
  if (filterType.filterValue === "Is equal to") {
    filters.data![elementId] = {
      op: "equals",
      value: parseInt(filterType.filterComboBoxValue as string),
    };
  } else if (filterType.filterValue === "Is less than") {
    filters.data![elementId] = {
      op: "lessThan",
      value: parseInt(filterType.filterComboBoxValue as string),
    };
  } else if (filterType.filterValue === "Is more than") {
    filters.data![elementId] = {
      op: "greaterThan",
      value: parseInt(filterType.filterComboBoxValue as string),
    };
  } else if (filterType.filterValue === "Submitted") {
    filters.data![elementId] = { op: "submitted" };
  } else if (filterType.filterValue === "Skipped") {
    filters.data![elementId] = { op: "skipped" };
  } else if (filterType.filterValue === "Includes either") {
    filters.data![elementId] = {
      op: "includesOne",
      value: (filterType.filterComboBoxValue as string[]).map((value) => parseInt(value)),
    };
  }
};

// Helper function to process CTA filters
const processCTAFilter = (
  filterType: FilterValue["filterType"],
  elementId: string,
  filters: TResponseFilterCriteria
) => {
  if (filterType.filterComboBoxValue === "Clicked") {
    filters.data![elementId] = { op: "clicked" };
  } else if (filterType.filterComboBoxValue === "Dismissed") {
    filters.data![elementId] = { op: "skipped" };
  }
};

// Helper function to process Consent filters
const processConsentFilter = (
  filterType: FilterValue["filterType"],
  elementId: string,
  filters: TResponseFilterCriteria
) => {
  if (filterType.filterComboBoxValue === "Accepted") {
    filters.data![elementId] = { op: "accepted" };
  } else if (filterType.filterComboBoxValue === "Dismissed") {
    filters.data![elementId] = { op: "skipped" };
  }
};

// Helper function to process Picture Selection filters
const processPictureSelectionFilter = (
  filterType: FilterValue["filterType"],
  elementId: string,
  element: ReturnType<typeof getElementsFromBlocks>[number] | undefined,
  filters: TResponseFilterCriteria
) => {
  if (
    element?.type !== TSurveyElementTypeEnum.PictureSelection ||
    !Array.isArray(filterType.filterComboBoxValue)
  ) {
    return;
  }

  const selectedOptions = filterType.filterComboBoxValue
    .map((option) => {
      const index = parseInt(option.split(" ")[1]);
      return element?.choices[index - 1]?.id;
    })
    .filter(Boolean);

  if (filterType.filterValue === "Includes all") {
    filters.data![elementId] = { op: "includesAll", value: selectedOptions };
  } else if (filterType.filterValue === "Includes either") {
    filters.data![elementId] = { op: "includesOne", value: selectedOptions };
  }
};

// Helper function to process Matrix filters
const processMatrixFilter = (
  filterType: FilterValue["filterType"],
  elementId: string,
  filters: TResponseFilterCriteria
) => {
  if (
    filterType.filterValue &&
    filterType.filterComboBoxValue &&
    typeof filterType.filterComboBoxValue === "string"
  ) {
    filters.data![elementId] = {
      op: "matrix",
      value: { [filterType.filterValue]: filterType.filterComboBoxValue },
    };
  }
};

// Helper function to process element filters
const processElementFilters = (
  elements: FilterValue[],
  survey: TSurvey,
  filters: TResponseFilterCriteria
) => {
  if (!elements.length) return;

  const surveyElements = getElementsFromBlocks(survey.blocks);
  filters.data = filters.data || {};

  elements.forEach(({ filterType, elementType }) => {
    const elementId = elementType.id ?? "";
    const element = surveyElements.find((q) => q.id === elementId);

    switch (elementType.elementType) {
      case TSurveyElementTypeEnum.OpenText:
      case TSurveyElementTypeEnum.Address:
      case TSurveyElementTypeEnum.ContactInfo:
        processFilledOutSkippedFilter(filterType, elementId, filters);
        break;
      case TSurveyElementTypeEnum.Ranking:
        processRankingFilter(filterType, elementId, filters);
        break;
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
      case TSurveyElementTypeEnum.MultipleChoiceMulti:
        processMultipleChoiceFilter(filterType, elementId, filters);
        break;
      case TSurveyElementTypeEnum.NPS:
      case TSurveyElementTypeEnum.Rating:
      case TSurveyElementTypeEnum.CSAT:
      case TSurveyElementTypeEnum.CES:
        processNPSRatingFilter(filterType, elementId, filters);
        break;
      case TSurveyElementTypeEnum.CTA:
        processCTAFilter(filterType, elementId, filters);
        break;
      case TSurveyElementTypeEnum.Consent:
        processConsentFilter(filterType, elementId, filters);
        break;
      case TSurveyElementTypeEnum.PictureSelection:
        processPictureSelectionFilter(filterType, elementId, element, filters);
        break;
      case TSurveyElementTypeEnum.Matrix:
        processMatrixFilter(filterType, elementId, filters);
        break;
    }
  });
};

// Helper function to process equals/not equals filters (for attributes, others)
const processEqualsNotEqualsFilter = (
  filterType: FilterValue["filterType"],
  label: string | undefined,
  filters: TResponseFilterCriteria,
  targetKey: "contactAttributes" | "others"
) => {
  if (!filterType.filterComboBoxValue) return;

  if (targetKey === "contactAttributes") {
    filters.contactAttributes = filters.contactAttributes || {};
    if (filterType.filterValue === "Equals") {
      filters.contactAttributes[label ?? ""] = {
        op: "equals",
        value: filterType.filterComboBoxValue as string,
      };
    } else if (filterType.filterValue === "Not equals") {
      filters.contactAttributes[label ?? ""] = {
        op: "notEquals",
        value: filterType.filterComboBoxValue as string,
      };
    }
  } else if (targetKey === "others") {
    filters.others = filters.others || {};
    if (filterType.filterValue === "Equals") {
      filters.others[label ?? ""] = { op: "equals", value: filterType.filterComboBoxValue as string };
    } else if (filterType.filterValue === "Not equals") {
      filters.others[label ?? ""] = { op: "notEquals", value: filterType.filterComboBoxValue as string };
    }
  }
};

// Reserved-field filter rows → the `reserved` criteria group, keyed by catalog name (ENG-1848).
const processReservedFilters = (
  reserved: FilterValue[],
  survey: TSurvey,
  filters: TResponseFilterCriteria
) => {
  if (!reserved.length) return;

  const entriesByName = new Map(getReservedFilterEntries(survey).map((entry) => [entry.name, entry]));

  reserved.forEach(({ filterType, elementType }) => {
    const entry = entriesByName.get(elementType.id ?? "");
    if (!entry) return; // fail closed: shadowed/gated names never emit a reserved condition

    const condition = buildTypedFieldCondition(filterType, entry.dataType);
    if (!condition) return;
    filters.reserved = filters.reserved || {};
    filters.reserved[entry.name] = condition;
  });
};

// Computed-field filter rows → the `variables` criteria group, keyed by storageKey (ENG-1848).
const processVariableFilters = (
  variables: FilterValue[],
  survey: TSurvey,
  filters: TResponseFilterCriteria
) => {
  if (!variables.length) return;

  const fieldsByKey = new Map(
    getComputedEmbeddedFields(survey).map((field) => [field.link.storageKey, field])
  );

  variables.forEach(({ filterType, elementType }) => {
    const field = fieldsByKey.get(elementType.id ?? "");
    if (!field) return;

    const condition = buildTypedFieldCondition(filterType, field.field.dataType);
    if (!condition) return;
    filters.variables = filters.variables || {};
    filters.variables[field.link.storageKey] = condition;
  });
};

// Ingested-field filter rows → the `data` group under the storageKey. Presence maps onto the data
// group's own vocabulary: submitted (key present) / skipped (absent or empty), matching isSet's
// treatment of "" as not set.
const processIngestedFilters = (
  hiddenFields: FilterValue[],
  survey: TSurvey,
  filters: TResponseFilterCriteria
) => {
  if (!hiddenFields.length) return;

  const fieldsByKey = new Map(
    getIngestedEmbeddedFields(survey).map((field) => [field.link.storageKey, field])
  );

  hiddenFields.forEach(({ filterType, elementType }) => {
    const field = fieldsByKey.get(elementType.id ?? "");
    if (!field) return;

    const condition = buildTypedFieldCondition(filterType, field.field.dataType);
    if (!condition) return;
    filters.data = filters.data || {};
    if (condition.op === "isSet") {
      filters.data[field.link.storageKey] = { op: "submitted" };
    } else if (condition.op === "isNotSet") {
      filters.data[field.link.storageKey] = { op: "skipped" };
    } else {
      filters.data[field.link.storageKey] = condition;
    }
  });
};

// Helper function to process quota filters
const processQuotaFilters = (quotas: FilterValue[], filters: TResponseFilterCriteria) => {
  if (!quotas.length) return;

  filters.quotas = filters.quotas || {};

  const statusMap: Record<string, "screenedIn" | "screenedOut" | "screenedOutNotInQuota"> = {
    "Screened in": "screenedIn",
    "Screened out (overquota)": "screenedOut",
    "Not in quota": "screenedOutNotInQuota",
  };

  quotas.forEach(({ filterType, elementType }) => {
    const quotaId = elementType.id;
    if (!quotaId) return;

    const op = statusMap[String(filterType.filterComboBoxValue)];
    if (op) filters.quotas![quotaId] = { op };
  });
};

// get the formatted filter expression to fetch filtered responses
export const getFormattedFilters = (
  survey: TSurvey,
  selectedFilter: SelectedFilterValue,
  dateRange: DateRange
): TResponseFilterCriteria => {
  const filters: TResponseFilterCriteria = {};

  const elements: FilterValue[] = [];
  const tags: FilterValue[] = [];
  const attributes: FilterValue[] = [];
  const others: FilterValue[] = [];
  const meta: FilterValue[] = [];
  const hiddenFields: FilterValue[] = [];
  const variables: FilterValue[] = [];
  const quotas: FilterValue[] = [];

  selectedFilter.filter.forEach((filter) => {
    if (filter.elementType?.type === "Elements") {
      elements.push(filter);
    } else if (filter.elementType?.type === "Tags") {
      tags.push(filter);
    } else if (filter.elementType?.type === "Attributes") {
      attributes.push(filter);
    } else if (filter.elementType?.type === "Other Filters") {
      others.push(filter);
    } else if (filter.elementType?.type === "Meta") {
      meta.push(filter);
    } else if (filter.elementType?.type === "Hidden Fields") {
      hiddenFields.push(filter);
    } else if (filter.elementType?.type === "Variables") {
      variables.push(filter);
    } else if (filter.elementType?.type === "Quotas") {
      quotas.push(filter);
    }
  });

  // for completed responses
  if (selectedFilter.responseStatus === "complete") {
    filters["finished"] = true;
  } else if (selectedFilter.responseStatus === "partial") {
    filters["finished"] = false;
  }

  // for date range responses
  if (dateRange.from && dateRange.to) {
    filters["createdAt"] = {
      min: dateRange.from,
      max: dateRange.to,
    };
  }

  // for tags
  if (tags.length) {
    filters["tags"] = {
      applied: [],
      notApplied: [],
    };
    tags.forEach((tag) => {
      if (tag.filterType.filterComboBoxValue === "Applied") {
        filters.tags?.applied?.push(tag.elementType.label ?? "");
      } else {
        filters.tags?.notApplied?.push(tag.elementType.label ?? "");
      }
    });
  }

  processElementFilters(elements, survey, filters);
  processIngestedFilters(hiddenFields, survey, filters);
  processVariableFilters(variables, survey, filters);

  // for attributes
  if (attributes.length) {
    filters.contactAttributes = filters.contactAttributes || {};
    attributes.forEach(({ filterType, elementType }) => {
      processEqualsNotEqualsFilter(filterType, elementType.label, filters, "contactAttributes");
    });
  }

  // for others
  if (others.length) {
    filters.others = filters.others || {};
    others.forEach(({ filterType, elementType }) => {
      processEqualsNotEqualsFilter(filterType, elementType.label, filters, "others");
    });
  }

  processReservedFilters(meta, survey, filters);
  processQuotaFilters(quotas, filters);

  return filters;
};

// get the today date with full hours
export const getTodayDate = (): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};
