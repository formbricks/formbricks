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
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import {
  ElementOption,
  ElementOptions,
  OptionsType,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ElementsComboBox";
import { ElementFilterOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResponseFilter";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { recallToHeadline } from "@/lib/utils/recall";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/**
 * Internal constant keys used for filter logic comparisons.
 * These values are stored in state and compared in processXFilter functions.
 * They must remain stable (not translated) so filter logic is language-independent.
 */
export const FILTER_CONDITION = {
  IS: "is",
  INCLUDES_EITHER: "Includes either",
  INCLUDES_ALL: "Includes all",
  IS_EQUAL_TO: "Is equal to",
  IS_LESS_THAN: "Is less than",
  IS_MORE_THAN: "Is more than",
  SUBMITTED: "Submitted",
  SKIPPED: "Skipped",
  EQUALS: "Equals",
  NOT_EQUALS: "Not equals",
  STATUS: "Status",
} as const;

export const FILTER_VALUE = {
  FILLED_OUT: "Filled out",
  SKIPPED: "Skipped",
  CLICKED: "Clicked",
  DISMISSED: "Dismissed",
  APPLIED: "Applied",
  NOT_APPLIED: "Not applied",
  ACCEPTED: "Accepted",
  SCREENED_IN: "Screened in",
  SCREENED_OUT_OVERQUOTA: "Screened out (overquota)",
  NOT_IN_QUOTA: "Not in quota",
} as const;

/** i18n key map: internal constant value → translation key */
export const CONDITION_I18N_KEYS: Record<string, string> = {
  [FILTER_CONDITION.IS]: "environments.surveys.summary.filter_condition_is",
  [FILTER_CONDITION.INCLUDES_EITHER]: "environments.surveys.summary.includes_either",
  [FILTER_CONDITION.INCLUDES_ALL]: "environments.surveys.summary.includes_all",
  [FILTER_CONDITION.IS_EQUAL_TO]: "environments.surveys.summary.is_equal_to",
  [FILTER_CONDITION.IS_LESS_THAN]: "environments.surveys.summary.is_less_than",
  [FILTER_CONDITION.IS_MORE_THAN]: "environments.surveys.summary.is_more_than",
  [FILTER_CONDITION.SUBMITTED]: "environments.surveys.summary.filter_condition_submitted",
  [FILTER_CONDITION.SKIPPED]: "environments.surveys.summary.filter_condition_skipped",
  [FILTER_CONDITION.EQUALS]: "environments.surveys.summary.filter_condition_equals",
  [FILTER_CONDITION.NOT_EQUALS]: "environments.surveys.summary.filter_condition_not_equals",
  [FILTER_CONDITION.STATUS]: "environments.surveys.summary.filter_condition_status",
};

export const FILTER_VALUE_I18N_KEYS: Record<string, string> = {
  [FILTER_VALUE.FILLED_OUT]: "environments.surveys.summary.filter_value_filled_out",
  [FILTER_VALUE.SKIPPED]: "environments.surveys.summary.filter_value_skipped",
  [FILTER_VALUE.CLICKED]: "environments.surveys.summary.filter_value_clicked",
  [FILTER_VALUE.DISMISSED]: "environments.surveys.summary.filter_value_dismissed",
  [FILTER_VALUE.APPLIED]: "environments.surveys.summary.filter_value_applied",
  [FILTER_VALUE.NOT_APPLIED]: "environments.surveys.summary.filter_value_not_applied",
  [FILTER_VALUE.ACCEPTED]: "environments.surveys.summary.filter_value_accepted",
  [FILTER_VALUE.SCREENED_IN]: "environments.surveys.summary.filter_value_screened_in",
  [FILTER_VALUE.SCREENED_OUT_OVERQUOTA]: "environments.surveys.summary.filter_value_screened_out_overquota",
  [FILTER_VALUE.NOT_IN_QUOTA]: "environments.surveys.summary.filter_value_not_in_quota",
};

type TFunction = (key: string) => string;

/**
 * Translates a filter condition or value string using the provided t() function.
 * Falls back to the original string if no translation key is found.
 */
const translateFilterString = (value: string, t: TFunction): string => {
  const key = CONDITION_I18N_KEYS[value] ?? FILTER_VALUE_I18N_KEYS[value];
  return key ? t(key) : value;
};

const conditionOptions: Record<string, string[]> = {
  openText: [FILTER_CONDITION.IS],
  multipleChoiceSingle: [FILTER_CONDITION.INCLUDES_EITHER],
  multipleChoiceMulti: [FILTER_CONDITION.INCLUDES_ALL, FILTER_CONDITION.INCLUDES_EITHER],
  nps: [
    FILTER_CONDITION.IS_EQUAL_TO,
    FILTER_CONDITION.IS_LESS_THAN,
    FILTER_CONDITION.IS_MORE_THAN,
    FILTER_CONDITION.SUBMITTED,
    FILTER_CONDITION.SKIPPED,
    FILTER_CONDITION.INCLUDES_EITHER,
  ],
  rating: [
    FILTER_CONDITION.IS_EQUAL_TO,
    FILTER_CONDITION.IS_LESS_THAN,
    FILTER_CONDITION.IS_MORE_THAN,
    FILTER_CONDITION.SUBMITTED,
    FILTER_CONDITION.SKIPPED,
  ],
  cta: [FILTER_CONDITION.IS],
  tags: [FILTER_CONDITION.IS],
  languages: [FILTER_CONDITION.EQUALS, FILTER_CONDITION.NOT_EQUALS],
  pictureSelection: [FILTER_CONDITION.INCLUDES_ALL, FILTER_CONDITION.INCLUDES_EITHER],
  userAttributes: [FILTER_CONDITION.EQUALS, FILTER_CONDITION.NOT_EQUALS],
  consent: [FILTER_CONDITION.IS],
  matrix: [""],
  address: [FILTER_CONDITION.IS],
  contactInfo: [FILTER_CONDITION.IS],
  ranking: [FILTER_CONDITION.IS],
};
const filterOptions: Record<string, string[]> = {
  openText: [FILTER_VALUE.FILLED_OUT, FILTER_VALUE.SKIPPED],
  rating: ["1", "2", "3", "4", "5"],
  nps: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  cta: [FILTER_VALUE.CLICKED, FILTER_VALUE.DISMISSED],
  tags: [FILTER_VALUE.APPLIED, FILTER_VALUE.NOT_APPLIED],
  consent: [FILTER_VALUE.ACCEPTED, FILTER_VALUE.DISMISSED],
  address: [FILTER_VALUE.FILLED_OUT, FILTER_VALUE.SKIPPED],
  contactInfo: [FILTER_VALUE.FILLED_OUT, FILTER_VALUE.SKIPPED],
  ranking: [FILTER_VALUE.FILLED_OUT, FILTER_VALUE.SKIPPED],
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

export const generateElementAndFilterOptions = (
  survey: TSurvey,
  environmentTags: TTag[] | undefined,
  attributes: TSurveyContactAttributes,
  meta: TSurveyMetaFieldFilter,
  hiddenFields: TResponseHiddenFieldsFilter,
  quotas: TSurveyQuota[]
): {
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
    environmentTags?.forEach((tag) => {
      elementFilterOptions.push({
        type: "Tags",
        filterOptions: conditionOptions.tags,
        filterComboBoxOptions: filterOptions.tags,
        id: tag.id,
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

  if (meta) {
    elementOptions = [
      ...elementOptions,
      {
        header: OptionsType.META,
        option: Object.keys(meta).map((m) => {
          return { label: m, type: OptionsType.META, id: m };
        }),
      },
    ];
    Object.keys(meta).forEach((m) => {
      elementFilterOptions.push({
        type: "Meta",
        filterOptions:
          m === "url"
            ? Object.keys(META_OP_MAP)
            : [FILTER_CONDITION.EQUALS, FILTER_CONDITION.NOT_EQUALS],
        filterComboBoxOptions: meta[m],
        id: m,
      });
    });
  }

  if (hiddenFields) {
    elementOptions = [
      ...elementOptions,
      {
        header: OptionsType.HIDDEN_FIELDS,
        option: Object.keys(hiddenFields).map((hiddenField) => {
          return { label: hiddenField, type: OptionsType.HIDDEN_FIELDS, id: hiddenField };
        }),
      },
    ];
    Object.keys(hiddenFields).forEach((hiddenField) => {
      elementFilterOptions.push({
        type: "Hidden Fields",
        filterOptions: [FILTER_CONDITION.EQUALS, FILTER_CONDITION.NOT_EQUALS],
        filterComboBoxOptions: hiddenFields[hiddenField],
        id: hiddenField,
      });
    });
  }

  let languageElement: ElementOption[] = [];

  //can be extended to include more properties
  if (survey.languages?.length > 0) {
    languageElement.push({ label: "Language", type: OptionsType.OTHERS, id: "language" }); // "Language" label is translated in the component layer
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
        filterOptions: [FILTER_CONDITION.STATUS],
        filterComboBoxOptions: [
          FILTER_VALUE.SCREENED_IN,
          FILTER_VALUE.SCREENED_OUT_OVERQUOTA,
          FILTER_VALUE.NOT_IN_QUOTA,
        ],
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

// Helper function to process equals/not equals filters (for hiddenFields, attributes, others)
const processEqualsNotEqualsFilter = (
  filterType: FilterValue["filterType"],
  label: string | undefined,
  filters: TResponseFilterCriteria,
  targetKey: "data" | "contactAttributes" | "others"
) => {
  if (!filterType.filterComboBoxValue) return;

  if (targetKey === "data") {
    filters.data = filters.data || {};
    if (filterType.filterValue === "Equals") {
      filters.data[label ?? ""] = { op: "equals", value: filterType.filterComboBoxValue as string };
    } else if (filterType.filterValue === "Not equals") {
      filters.data[label ?? ""] = { op: "notEquals", value: filterType.filterComboBoxValue as string };
    }
  } else if (targetKey === "contactAttributes") {
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

// Helper function to process meta filters
const processMetaFilters = (meta: FilterValue[], filters: TResponseFilterCriteria) => {
  if (!meta.length) return;

  filters.meta = filters.meta || {};

  meta.forEach(({ filterType, elementType }) => {
    const label = elementType.label ?? "";
    const metaFilters = filters.meta!; // Safe because we initialized it above

    // For text input cases (URL filtering)
    if (typeof filterType.filterComboBoxValue === "string" && filterType.filterComboBoxValue.length > 0) {
      const value = filterType.filterComboBoxValue.trim();
      const op = META_OP_MAP[filterType.filterValue as keyof typeof META_OP_MAP];
      if (op) {
        metaFilters[label] = { op, value };
      }
    }
    // For dropdown/select cases (existing metadata fields)
    else if (Array.isArray(filterType.filterComboBoxValue) && filterType.filterComboBoxValue.length > 0) {
      const value = filterType.filterComboBoxValue[0];
      if (filterType.filterValue === "Equals") {
        metaFilters[label] = { op: "equals", value };
      } else if (filterType.filterValue === "Not equals") {
        metaFilters[label] = { op: "notEquals", value };
      }
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

  // for hidden fields
  if (hiddenFields.length) {
    filters.data = filters.data || {};
    hiddenFields.forEach(({ filterType, elementType }) => {
      processEqualsNotEqualsFilter(filterType, elementType.label, filters, "data");
    });
  }

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

  processMetaFilters(meta, filters);
  processQuotaFilters(quotas, filters);

  return filters;
};

// get the today date with full hours
export const getTodayDate = (): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};
