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
} from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  ElementOption,
  ElementOptions,
  OptionsType,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ElementsComboBox";
import { ElementFilterOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResponseFilter";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { recallToHeadline } from "@/lib/utils/recall";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

const conditionOptions = {
  openText: ["is"],
  multipleChoiceSingle: ["Includes either"],
  multipleChoiceMulti: ["Includes all", "Includes either"],
  nps: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped", "Includes either"],
  rating: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped"],
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
const filterOptions = {
  openText: ["Filled out", "Skipped"],
  rating: ["1", "2", "3", "4", "5"],
  nps: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  cta: ["Clicked", "Dismissed"],
  tags: ["Applied", "Not applied"],
  consent: ["Accepted", "Dismissed"],
  address: ["Filled out", "Skipped"],
  contactInfo: ["Filled out", "Skipped"],
  ranking: ["Filled out", "Skipped"],
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
  let elementFilterOptions: any = [];

  let elementsOptions: any = [];
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
    if (Object.keys(conditionOptions).includes(q.type)) {
      if (q.type === TSurveyElementTypeEnum.MultipleChoiceSingle) {
        elementFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices ? q?.choices?.map((c) => c?.label) : [""],
          id: q.id,
        });
      } else if (q.type === TSurveyElementTypeEnum.MultipleChoiceMulti) {
        elementFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices
            ? q?.choices?.filter((c) => c.id !== "other")?.map((c) => c?.label)
            : [""],
          id: q.id,
        });
      } else if (q.type === TSurveyElementTypeEnum.PictureSelection) {
        elementFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices ? q?.choices?.map((_, idx) => `Picture ${idx + 1}`) : [""],
          id: q.id,
        });
      } else if (q.type === TSurveyElementTypeEnum.Matrix) {
        elementFilterOptions.push({
          type: q.type,
          filterOptions: q.rows.flatMap((row) => Object.values(row)),
          filterComboBoxOptions: q.columns.flatMap((column) => Object.values(column)),
          id: q.id,
        });
      } else {
        elementFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: filterOptions[q.type],
          id: q.id,
        });
      }
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
        filterOptions: m === "url" ? Object.keys(META_OP_MAP) : ["Equals", "Not equals"],
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
        filterOptions: ["Equals", "Not equals"],
        filterComboBoxOptions: hiddenFields[hiddenField],
        id: hiddenField,
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
        filterComboBoxOptions: ["Screened in", "Screened out (overquota)", "Screened out (not in quota)"],
        id: quota.id,
      });
    });
  }

  return { elementOptions: [...elementOptions], elementFilterOptions: [...elementFilterOptions] };
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

  if (elements.length) {
    const surveyElements = getElementsFromBlocks(survey.blocks);
    elements.forEach(({ filterType, elementType }) => {
      if (!filters.data) filters.data = {};
      switch (elementType.elementType) {
        case TSurveyElementTypeEnum.OpenText:
        case TSurveyElementTypeEnum.Address:
        case TSurveyElementTypeEnum.ContactInfo: {
          if (filterType.filterComboBoxValue === "Filled out") {
            filters.data[elementType.id ?? ""] = {
              op: "filledOut",
            };
          } else if (filterType.filterComboBoxValue === "Skipped") {
            filters.data[elementType.id ?? ""] = {
              op: "skipped",
            };
          }
          break;
        }
        case TSurveyElementTypeEnum.Ranking: {
          if (filterType.filterComboBoxValue === "Filled out") {
            filters.data[elementType.id ?? ""] = {
              op: "submitted",
            };
          } else if (filterType.filterComboBoxValue === "Skipped") {
            filters.data[elementType.id ?? ""] = {
              op: "skipped",
            };
          }
          break;
        }
        case TSurveyElementTypeEnum.MultipleChoiceSingle:
        case TSurveyElementTypeEnum.MultipleChoiceMulti: {
          if (filterType.filterValue === "Includes either") {
            filters.data[elementType.id ?? ""] = {
              op: "includesOne",
              value: filterType.filterComboBoxValue as string[],
            };
          } else if (filterType.filterValue === "Includes all") {
            filters.data[elementType.id ?? ""] = {
              op: "includesAll",
              value: filterType.filterComboBoxValue as string[],
            };
          }
          break;
        }
        case TSurveyElementTypeEnum.NPS:
        case TSurveyElementTypeEnum.Rating: {
          if (filterType.filterValue === "Is equal to") {
            filters.data[elementType.id ?? ""] = {
              op: "equals",
              value: parseInt(filterType.filterComboBoxValue as string),
            };
          } else if (filterType.filterValue === "Is less than") {
            filters.data[elementType.id ?? ""] = {
              op: "lessThan",
              value: parseInt(filterType.filterComboBoxValue as string),
            };
          } else if (filterType.filterValue === "Is more than") {
            filters.data[elementType.id ?? ""] = {
              op: "greaterThan",
              value: parseInt(filterType.filterComboBoxValue as string),
            };
          } else if (filterType.filterValue === "Submitted") {
            filters.data[elementType.id ?? ""] = {
              op: "submitted",
            };
          } else if (filterType.filterValue === "Skipped") {
            filters.data[elementType.id ?? ""] = {
              op: "skipped",
            };
          } else if (filterType.filterValue === "Includes either") {
            filters.data[elementType.id ?? ""] = {
              op: "includesOne",
              value: (filterType.filterComboBoxValue as string[]).map((value) => parseInt(value)),
            };
          }
          break;
        }
        case TSurveyElementTypeEnum.CTA: {
          if (filterType.filterComboBoxValue === "Clicked") {
            filters.data[elementType.id ?? ""] = {
              op: "clicked",
            };
          } else if (filterType.filterComboBoxValue === "Dismissed") {
            filters.data[elementType.id ?? ""] = {
              op: "skipped",
            };
          }
          break;
        }
        case TSurveyElementTypeEnum.Consent: {
          if (filterType.filterComboBoxValue === "Accepted") {
            filters.data[elementType.id ?? ""] = {
              op: "accepted",
            };
          } else if (filterType.filterComboBoxValue === "Dismissed") {
            filters.data[elementType.id ?? ""] = {
              op: "skipped",
            };
          }
          break;
        }
        case TSurveyElementTypeEnum.PictureSelection: {
          const elementId = elementType.id ?? "";
          const element = surveyElements.find((q) => q.id === elementId);

          if (
            element?.type !== TSurveyElementTypeEnum.PictureSelection ||
            !Array.isArray(filterType.filterComboBoxValue)
          ) {
            return;
          }

          const selectedOptions = filterType.filterComboBoxValue.map((option) => {
            const index = parseInt(option.split(" ")[1]);
            return element?.choices[index - 1].id;
          });

          if (filterType.filterValue === "Includes all") {
            filters.data[elementId] = {
              op: "includesAll",
              value: selectedOptions,
            };
          } else if (filterType.filterValue === "Includes either") {
            filters.data[elementId] = {
              op: "includesOne",
              value: selectedOptions,
            };
          }
          break;
        }
        case TSurveyElementTypeEnum.Matrix: {
          if (
            filterType.filterValue &&
            filterType.filterComboBoxValue &&
            typeof filterType.filterComboBoxValue === "string"
          ) {
            filters.data[elementType.id ?? ""] = {
              op: "matrix",
              value: { [filterType.filterValue]: filterType.filterComboBoxValue },
            };
          }
          break;
        }
      }
    });
  }

  // for hidden fields
  if (hiddenFields.length) {
    hiddenFields.forEach(({ filterType, elementType }) => {
      if (!filters.data) filters.data = {};
      if (!filterType.filterComboBoxValue) return;
      if (filterType.filterValue === "Equals") {
        filters.data[elementType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.data[elementType.label ?? ""] = {
          op: "notEquals",
          value: filterType.filterComboBoxValue as string,
        };
      }
    });
  }

  // for attributes
  if (attributes.length) {
    attributes.forEach(({ filterType, elementType }) => {
      if (!filters.contactAttributes) filters.contactAttributes = {};
      if (!filterType.filterComboBoxValue) return;
      if (filterType.filterValue === "Equals") {
        filters.contactAttributes[elementType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.contactAttributes[elementType.label ?? ""] = {
          op: "notEquals",
          value: filterType.filterComboBoxValue as string,
        };
      }
    });
  }

  // for others
  if (others.length) {
    others.forEach(({ filterType, elementType }) => {
      if (!filters.others) filters.others = {};
      if (!filterType.filterComboBoxValue) return;
      if (filterType.filterValue === "Equals") {
        filters.others[elementType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.others[elementType.label ?? ""] = {
          op: "notEquals",
          value: filterType.filterComboBoxValue as string,
        };
      }
    });
  }

  // for meta
  if (meta.length) {
    meta.forEach(({ filterType, elementType }) => {
      if (!filters.meta) filters.meta = {};

      // For text input cases (URL filtering)
      if (typeof filterType.filterComboBoxValue === "string" && filterType.filterComboBoxValue.length > 0) {
        const value = filterType.filterComboBoxValue.trim();
        const op = META_OP_MAP[filterType.filterValue as keyof typeof META_OP_MAP];
        if (op) {
          filters.meta[elementType.label ?? ""] = { op, value };
        }
      }
      // For dropdown/select cases (existing metadata fields)
      else if (Array.isArray(filterType.filterComboBoxValue) && filterType.filterComboBoxValue.length > 0) {
        const value = filterType.filterComboBoxValue[0]; // Take first selected value
        if (filterType.filterValue === "Equals") {
          filters.meta[elementType.label ?? ""] = { op: "equals", value };
        } else if (filterType.filterValue === "Not equals") {
          filters.meta[elementType.label ?? ""] = { op: "notEquals", value };
        }
      }
    });
  }

  if (quotas.length) {
    quotas.forEach(({ filterType, elementType }) => {
      filters.quotas ??= {};
      const quotaId = elementType.id;
      if (!quotaId) return;

      const statusMap: Record<string, "screenedIn" | "screenedOut" | "screenedOutNotInQuota"> = {
        "Screened in": "screenedIn",
        "Screened out (overquota)": "screenedOut",
        "Screened out (not in quota)": "screenedOutNotInQuota",
      };
      const op = statusMap[String(filterType.filterComboBoxValue)];
      if (op) filters.quotas[quotaId] = { op };
    });
  }

  return filters;
};

// get the today date with full hours
export const getTodayDate = (): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};
