import {
  DateRange,
  FilterValue,
  SelectedFilterValue,
} from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  OptionsType,
  QuestionOption,
  QuestionOptions,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionsComboBox";
import { QuestionFilterOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResponseFilter";
import {
  TResponseFilterCriteria,
  TResponseHiddenFieldsFilter,
  TSurveyContactAttributes,
  TSurveyMetaFieldFilter,
} from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";

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

// creating the options for the filtering to be selected there are 4 types questions, attributes, tags and metadata
export const generateQuestionAndFilterOptions = (
  survey: TSurvey,
  environmentTags: TTag[] | undefined,
  attributes: TSurveyContactAttributes,
  meta: TSurveyMetaFieldFilter,
  hiddenFields: TResponseHiddenFieldsFilter
): {
  questionOptions: QuestionOptions[];
  questionFilterOptions: QuestionFilterOptions[];
} => {
  let questionOptions: QuestionOptions[] = [];
  let questionFilterOptions: any = [];

  let questionsOptions: any = [];

  survey.questions.forEach((q) => {
    if (Object.keys(conditionOptions).includes(q.type)) {
      questionsOptions.push({
        label: q.headline,
        questionType: q.type,
        type: OptionsType.QUESTIONS,
        id: q.id,
      });
    }
  });
  questionOptions = [...questionOptions, { header: OptionsType.QUESTIONS, option: questionsOptions }];
  survey.questions.forEach((q) => {
    if (Object.keys(conditionOptions).includes(q.type)) {
      if (q.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle) {
        questionFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices ? q?.choices?.map((c) => c?.label) : [""],
          id: q.id,
        });
      } else if (q.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) {
        questionFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices
            ? q?.choices?.filter((c) => c.id !== "other")?.map((c) => c?.label)
            : [""],
          id: q.id,
        });
      } else if (q.type === TSurveyQuestionTypeEnum.PictureSelection) {
        questionFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices ? q?.choices?.map((_, idx) => `Picture ${idx + 1}`) : [""],
          id: q.id,
        });
      } else if (q.type === TSurveyQuestionTypeEnum.Matrix) {
        questionFilterOptions.push({
          type: q.type,
          filterOptions: q.rows.flatMap((row) => Object.values(row)),
          filterComboBoxOptions: q.columns.flatMap((column) => Object.values(column)),
          id: q.id,
        });
      } else {
        questionFilterOptions.push({
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
    questionOptions = [...questionOptions, { header: OptionsType.TAGS, option: tagsOptions }];
    environmentTags?.forEach((t) => {
      questionFilterOptions.push({
        type: "Tags",
        filterOptions: conditionOptions.tags,
        filterComboBoxOptions: filterOptions.tags,
        id: t.id,
      });
    });
  }

  if (attributes) {
    questionOptions = [
      ...questionOptions,
      {
        header: OptionsType.ATTRIBUTES,
        option: Object.keys(attributes).map((a) => {
          return { label: a, type: OptionsType.ATTRIBUTES, id: a };
        }),
      },
    ];
    Object.keys(attributes).forEach((a) => {
      questionFilterOptions.push({
        type: "Attributes",
        filterOptions: conditionOptions.userAttributes,
        filterComboBoxOptions: attributes[a],
        id: a,
      });
    });
  }

  if (meta) {
    questionOptions = [
      ...questionOptions,
      {
        header: OptionsType.META,
        option: Object.keys(meta).map((m) => {
          return { label: m, type: OptionsType.META, id: m };
        }),
      },
    ];
    Object.keys(meta).forEach((m) => {
      questionFilterOptions.push({
        type: "Meta",
        filterOptions: ["Equals", "Not equals"],
        filterComboBoxOptions: meta[m],
        id: m,
      });
    });
  }

  if (hiddenFields) {
    questionOptions = [
      ...questionOptions,
      {
        header: OptionsType.HIDDEN_FIELDS,
        option: Object.keys(hiddenFields).map((hiddenField) => {
          return { label: hiddenField, type: OptionsType.HIDDEN_FIELDS, id: hiddenField };
        }),
      },
    ];
    Object.keys(hiddenFields).forEach((hiddenField) => {
      questionFilterOptions.push({
        type: "Hidden Fields",
        filterOptions: ["Equals", "Not equals"],
        filterComboBoxOptions: hiddenFields[hiddenField],
        id: hiddenField,
      });
    });
  }

  let languageQuestion: QuestionOption[] = [];

  //can be extended to include more properties
  if (survey.languages?.length > 0) {
    languageQuestion.push({ label: "Language", type: OptionsType.OTHERS, id: "language" });
    const languageOptions = survey.languages.map((sl) => sl.language.code);
    questionFilterOptions.push({
      type: OptionsType.OTHERS,
      filterOptions: conditionOptions.languages,
      filterComboBoxOptions: languageOptions,
      id: "language",
    });
  }
  questionOptions = [...questionOptions, { header: OptionsType.OTHERS, option: languageQuestion }];

  return { questionOptions: [...questionOptions], questionFilterOptions: [...questionFilterOptions] };
};

// get the formatted filter expression to fetch filtered responses
export const getFormattedFilters = (
  survey: TSurvey,
  selectedFilter: SelectedFilterValue,
  dateRange: DateRange
): TResponseFilterCriteria => {
  const filters: TResponseFilterCriteria = {};

  const questions: FilterValue[] = [];
  const tags: FilterValue[] = [];
  const attributes: FilterValue[] = [];
  const others: FilterValue[] = [];
  const meta: FilterValue[] = [];
  const hiddenFields: FilterValue[] = [];

  selectedFilter.filter.forEach((filter) => {
    if (filter.questionType?.type === "Questions") {
      questions.push(filter);
    } else if (filter.questionType?.type === "Tags") {
      tags.push(filter);
    } else if (filter.questionType?.type === "Attributes") {
      attributes.push(filter);
    } else if (filter.questionType?.type === "Other Filters") {
      others.push(filter);
    } else if (filter.questionType?.type === "Meta") {
      meta.push(filter);
    } else if (filter.questionType?.type === "Hidden Fields") {
      hiddenFields.push(filter);
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
        filters.tags?.applied?.push(tag.questionType.label ?? "");
      } else {
        filters.tags?.notApplied?.push(tag.questionType.label ?? "");
      }
    });
  }

  // for questions
  if (questions.length) {
    questions.forEach(({ filterType, questionType }) => {
      if (!filters.data) filters.data = {};
      switch (questionType.questionType) {
        case TSurveyQuestionTypeEnum.OpenText:
        case TSurveyQuestionTypeEnum.Address:
        case TSurveyQuestionTypeEnum.ContactInfo: {
          if (filterType.filterComboBoxValue === "Filled out") {
            filters.data[questionType.id ?? ""] = {
              op: "filledOut",
            };
          } else if (filterType.filterComboBoxValue === "Skipped") {
            filters.data[questionType.id ?? ""] = {
              op: "skipped",
            };
          }
          break;
        }
        case TSurveyQuestionTypeEnum.Ranking: {
          if (filterType.filterComboBoxValue === "Filled out") {
            filters.data[questionType.id ?? ""] = {
              op: "submitted",
            };
          } else if (filterType.filterComboBoxValue === "Skipped") {
            filters.data[questionType.id ?? ""] = {
              op: "skipped",
            };
          }
          break;
        }
        case TSurveyQuestionTypeEnum.MultipleChoiceSingle:
        case TSurveyQuestionTypeEnum.MultipleChoiceMulti: {
          if (filterType.filterValue === "Includes either") {
            filters.data[questionType.id ?? ""] = {
              op: "includesOne",
              value: filterType.filterComboBoxValue as string[],
            };
          } else if (filterType.filterValue === "Includes all") {
            filters.data[questionType.id ?? ""] = {
              op: "includesAll",
              value: filterType.filterComboBoxValue as string[],
            };
          }
          break;
        }
        case TSurveyQuestionTypeEnum.NPS:
        case TSurveyQuestionTypeEnum.Rating: {
          if (filterType.filterValue === "Is equal to") {
            filters.data[questionType.id ?? ""] = {
              op: "equals",
              value: parseInt(filterType.filterComboBoxValue as string),
            };
          } else if (filterType.filterValue === "Is less than") {
            filters.data[questionType.id ?? ""] = {
              op: "lessThan",
              value: parseInt(filterType.filterComboBoxValue as string),
            };
          } else if (filterType.filterValue === "Is more than") {
            filters.data[questionType.id ?? ""] = {
              op: "greaterThan",
              value: parseInt(filterType.filterComboBoxValue as string),
            };
          } else if (filterType.filterValue === "Submitted") {
            filters.data[questionType.id ?? ""] = {
              op: "submitted",
            };
          } else if (filterType.filterValue === "Skipped") {
            filters.data[questionType.id ?? ""] = {
              op: "skipped",
            };
          } else if (filterType.filterValue === "Includes either") {
            filters.data[questionType.id ?? ""] = {
              op: "includesOne",
              value: (filterType.filterComboBoxValue as string[]).map((value) => parseInt(value)),
            };
          }
          break;
        }
        case TSurveyQuestionTypeEnum.CTA: {
          if (filterType.filterComboBoxValue === "Clicked") {
            filters.data[questionType.id ?? ""] = {
              op: "clicked",
            };
          } else if (filterType.filterComboBoxValue === "Dismissed") {
            filters.data[questionType.id ?? ""] = {
              op: "skipped",
            };
          }
          break;
        }
        case TSurveyQuestionTypeEnum.Consent: {
          if (filterType.filterComboBoxValue === "Accepted") {
            filters.data[questionType.id ?? ""] = {
              op: "accepted",
            };
          } else if (filterType.filterComboBoxValue === "Dismissed") {
            filters.data[questionType.id ?? ""] = {
              op: "skipped",
            };
          }
          break;
        }
        case TSurveyQuestionTypeEnum.PictureSelection: {
          const questionId = questionType.id ?? "";
          const question = survey.questions.find((q) => q.id === questionId);

          if (
            question?.type !== TSurveyQuestionTypeEnum.PictureSelection ||
            !Array.isArray(filterType.filterComboBoxValue)
          ) {
            return;
          }

          const selectedOptions = filterType.filterComboBoxValue.map((option) => {
            const index = parseInt(option.split(" ")[1]);
            return question?.choices[index - 1].id;
          });

          if (filterType.filterValue === "Includes all") {
            filters.data[questionId] = {
              op: "includesAll",
              value: selectedOptions,
            };
          } else if (filterType.filterValue === "Includes either") {
            filters.data[questionId] = {
              op: "includesOne",
              value: selectedOptions,
            };
          }
          break;
        }
        case TSurveyQuestionTypeEnum.Matrix: {
          if (
            filterType.filterValue &&
            filterType.filterComboBoxValue &&
            typeof filterType.filterComboBoxValue === "string"
          ) {
            filters.data[questionType.id ?? ""] = {
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
    hiddenFields.forEach(({ filterType, questionType }) => {
      if (!filters.data) filters.data = {};
      if (!filterType.filterComboBoxValue) return;
      if (filterType.filterValue === "Equals") {
        filters.data[questionType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.data[questionType.label ?? ""] = {
          op: "notEquals",
          value: filterType.filterComboBoxValue as string,
        };
      }
    });
  }

  // for attributes
  if (attributes.length) {
    attributes.forEach(({ filterType, questionType }) => {
      if (!filters.contactAttributes) filters.contactAttributes = {};
      if (!filterType.filterComboBoxValue) return;
      if (filterType.filterValue === "Equals") {
        filters.contactAttributes[questionType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.contactAttributes[questionType.label ?? ""] = {
          op: "notEquals",
          value: filterType.filterComboBoxValue as string,
        };
      }
    });
  }

  // for others
  if (others.length) {
    others.forEach(({ filterType, questionType }) => {
      if (!filters.others) filters.others = {};
      if (!filterType.filterComboBoxValue) return;
      if (filterType.filterValue === "Equals") {
        filters.others[questionType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.others[questionType.label ?? ""] = {
          op: "notEquals",
          value: filterType.filterComboBoxValue as string,
        };
      }
    });
  }

  // for meta
  if (meta.length) {
    meta.forEach(({ filterType, questionType }) => {
      if (!filters.meta) filters.meta = {};
      if (!filterType.filterComboBoxValue) return;
      if (filterType.filterValue === "Equals") {
        filters.meta[questionType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.meta[questionType.label ?? ""] = {
          op: "notEquals",
          value: filterType.filterComboBoxValue as string,
        };
      }
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
