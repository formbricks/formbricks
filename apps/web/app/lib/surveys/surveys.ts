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

import { TResponseFilterCriteria, TSurveyPersonAttributes } from "@formbricks/types/responses";
import { TSurveyQuestionType } from "@formbricks/types/surveys";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";

const conditionOptions = {
  openText: ["is"],
  multipleChoiceSingle: ["Includes either"],
  multipleChoiceMulti: ["Includes all", "Includes either"],
  nps: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped"],
  rating: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped"],
  cta: ["is"],
  tags: ["is"],
  languages: ["Equals", "Not equals"],
  pictureSelection: ["Includes all", "Includes either"],
  userAttributes: ["Equals", "Not equals"],
  consent: ["is"],
};
const filterOptions = {
  openText: ["Filled out", "Skipped"],
  rating: ["1", "2", "3", "4", "5"],
  nps: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  cta: ["Clicked", "Dismissed"],
  tags: ["Applied", "Not applied"],
  consent: ["Accepted", "Dismissed"],
};

// creating the options for the filtering to be selected there are 4 types questions, attributes, tags and metadata
export const generateQuestionAndFilterOptions = (
  survey: TSurvey,
  environmentTags: TTag[] | undefined,
  attributes: TSurveyPersonAttributes
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
      if (
        q.type === TSurveyQuestionType.MultipleChoiceMulti ||
        q.type === TSurveyQuestionType.MultipleChoiceSingle
      ) {
        questionFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices ? q?.choices?.map((c) => c?.label) : [""],
          id: q.id,
        });
      } else if (q.type === TSurveyQuestionType.PictureSelection) {
        questionFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices ? q?.choices?.map((_, idx) => `Picture ${idx + 1}`) : [""],
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

  let metadataOptions: QuestionOption[] = [];
  //can be extended to include more properties
  if (survey.languages?.length > 0) {
    metadataOptions.push({ label: "Language", type: OptionsType.METADATA, id: "language" });
    const languageOptions = survey.languages.map((sl) => sl.language.code);
    questionFilterOptions.push({
      type: "Metadata",
      filterOptions: conditionOptions.languages,
      filterComboBoxOptions: languageOptions,
      id: "language",
    });
  }
  questionOptions = [...questionOptions, { header: OptionsType.METADATA, option: metadataOptions }];

  return { questionOptions: [...questionOptions], questionFilterOptions: [...questionFilterOptions] };
};

// get the formatted filter expression to fetch filtered responses
export const getFormattedFilters = (
  survey: TSurvey,
  selectedFilter: SelectedFilterValue,
  dateRange: DateRange
): TResponseFilterCriteria => {
  const filters: TResponseFilterCriteria = {};
  const [questions, tags, attributes, metadata] = selectedFilter.filter.reduce(
    (result: [FilterValue[], FilterValue[], FilterValue[], FilterValue[]], filter) => {
      if (filter.questionType?.type === "Questions") {
        result[0].push(filter);
      } else if (filter.questionType?.type === "Tags") {
        result[1].push(filter);
      } else if (filter.questionType?.type === "Attributes") {
        result[2].push(filter);
      } else if (filter.questionType?.type === "Metadata") {
        result[3].push(filter);
      }
      return result;
    },
    [[], [], [], []]
  );

  // for completed responses
  if (selectedFilter.onlyComplete) {
    filters["finished"] = true;
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
        case TSurveyQuestionType.OpenText: {
          if (filterType.filterComboBoxValue === "Filled out") {
            filters.data[questionType.id ?? ""] = {
              op: "submitted",
            };
          } else if (filterType.filterComboBoxValue === "Skipped") {
            filters.data[questionType.id ?? ""] = {
              op: "skipped",
            };
          }
        }
        case TSurveyQuestionType.MultipleChoiceSingle:
        case TSurveyQuestionType.MultipleChoiceMulti: {
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
        }
        case TSurveyQuestionType.NPS:
        case TSurveyQuestionType.Rating: {
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
          }
        }
        case TSurveyQuestionType.CTA: {
          if (filterType.filterComboBoxValue === "Clicked") {
            filters.data[questionType.id ?? ""] = {
              op: "clicked",
            };
          } else if (filterType.filterComboBoxValue === "Dismissed") {
            filters.data[questionType.id ?? ""] = {
              op: "skipped",
            };
          }
        }
        case TSurveyQuestionType.Consent: {
          if (filterType.filterComboBoxValue === "Accepted") {
            filters.data[questionType.id ?? ""] = {
              op: "accepted",
            };
          } else if (filterType.filterComboBoxValue === "Dismissed") {
            filters.data[questionType.id ?? ""] = {
              op: "skipped",
            };
          }
        }
        case TSurveyQuestionType.PictureSelection: {
          const questionId = questionType.id ?? "";
          const question = survey.questions.find((q) => q.id === questionId);

          if (
            question?.type !== TSurveyQuestionType.PictureSelection ||
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
        }
      }
    });
  }

  if (attributes.length) {
    attributes.forEach(({ filterType, questionType }) => {
      if (!filters.personAttributes) filters.personAttributes = {};
      if (filterType.filterValue === "Equals") {
        filters.personAttributes[questionType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.personAttributes[questionType.label ?? ""] = {
          op: "notEquals",
          value: filterType.filterComboBoxValue as string,
        };
      }
    });
  }

  // for metadata
  if (metadata.length) {
    metadata.forEach(({ filterType, questionType }) => {
      if (!filters.metadata) filters.metadata = {};

      if (filterType.filterValue === "Equals") {
        filters.metadata[questionType.label ?? ""] = {
          op: "equals",
          value: filterType.filterComboBoxValue as string,
        };
      } else if (filterType.filterValue === "Not equals") {
        filters.metadata[questionType.label ?? ""] = {
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
