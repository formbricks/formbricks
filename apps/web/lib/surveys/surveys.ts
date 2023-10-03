import {
  DateRange,
  SelectedFilterValue,
} from "@/app/(app)/environments/[environmentId]/ResponseFilterContext";
import {
  OptionsType,
  QuestionOptions,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/QuestionsComboBox";
import { QuestionFilterOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/ResponseFilter";
import { QuestionType } from "@formbricks/types/questions";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TTag } from "@formbricks/types/v1/tags";
import { isWithinInterval } from "date-fns";

export const generateQuestionsAndAttributes = (survey: TSurvey, responses: TResponse[]) => {
  let questionNames: string[] = [];

  if (survey?.questions) {
    questionNames = survey.questions.map((question) => question.headline);
  }

  const attributeMap: Record<string, Record<string, string | number>> = {};

  if (responses) {
    responses.forEach((response) => {
      const { person } = response;
      if (person !== null) {
        const { id, attributes } = person;
        Object.keys(attributes).forEach((attributeName) => {
          if (!attributeMap.hasOwnProperty(attributeName)) {
            attributeMap[attributeName] = {};
          }
          attributeMap[attributeName][id] = attributes[attributeName];
        });
      }
    });
  }
  return {
    questionNames,
    attributeMap,
  };
};

const conditionOptions = {
  openText: ["is"],
  multipleChoiceSingle: ["Includes either"],
  multipleChoiceMulti: ["Includes all", "Includes either"],
  nps: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped"],
  rating: ["Is equal to", "Is less than", "Is more than", "Submitted", "Skipped"],
  cta: ["is"],
  tags: ["is"],
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

// creating an object for the attributes in key value format when key is string and value is an string array
const getPersonAttributes = (responses: TResponse[]): { [key: string]: any[] } | null => {
  let attributes: { [key: string]: any[] } = {};

  responses.forEach((obj) => {
    const personAttributes = obj.personAttributes;

    if (personAttributes && Object.keys(personAttributes).length > 0) {
      for (const [key, value] of Object.entries(personAttributes)) {
        if (attributes.hasOwnProperty(key)) {
          if (!attributes[key].includes(value)) {
            attributes[key].push(value);
          }
        } else {
          attributes[key] = [value];
        }
      }
    }
  });

  if (Object.keys(attributes).length > 0) {
    return attributes;
  } else {
    return null;
  }
};

// creating the options for the filtering to be selected there are three types questions, attributes and tags
export const generateQuestionAndFilterOptions = (
  survey: TSurvey,
  responses: TResponse[],
  environmentTags: TTag[] | undefined
): {
  questionOptions: QuestionOptions[];
  questionFilterOptions: QuestionFilterOptions[];
} => {
  let questionOptions: any = [];
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
      if (q.type === QuestionType.MultipleChoiceMulti || q.type === QuestionType.MultipleChoiceSingle) {
        questionFilterOptions.push({
          type: q.type,
          filterOptions: conditionOptions[q.type],
          filterComboBoxOptions: q?.choices ? q?.choices?.map((c) => c?.label) : [""],
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

  const attributes = getPersonAttributes(responses);
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

  return { questionOptions: [...questionOptions], questionFilterOptions: [...questionFilterOptions] };
};

// get the filtered responses
export const getFilterResponses = (
  responses: TResponse[],
  selectedFilter: SelectedFilterValue,
  survey: TSurvey,
  dateRange: DateRange
) => {
  // added the question on the response object to filter out the responses which has been selected
  let toBeFilterResponses = responses.map((r) => {
    return {
      ...r,
      questions: survey.questions.map((q) => {
        if (q.id in r.data) {
          return q;
        }
      }),
    };
  });

  // filtering the responses according to the value selected
  selectedFilter.filter.forEach((filter) => {
    if (filter.questionType?.type === "Questions") {
      switch (filter.questionType?.questionType) {
        case QuestionType.Consent:
          toBeFilterResponses = toBeFilterResponses.filter((response) => {
            const questionID = response.questions.find(
              (q) => q?.type === QuestionType.Consent && q?.id === filter?.questionType?.id
            )?.id;
            if (filter?.filterType?.filterComboBoxValue) {
              if (questionID) {
                const responseValue = response.data[questionID];
                if (filter?.filterType?.filterComboBoxValue === "Accepted") {
                  return responseValue === "accepted";
                }
                if (filter?.filterType?.filterComboBoxValue === "Dismissed") {
                  return responseValue === "dismissed";
                }
                return true;
              }
              return false;
            }
            return true;
          });
          break;
        case QuestionType.OpenText:
          toBeFilterResponses = toBeFilterResponses.filter((response) => {
            const questionID = response.questions.find(
              (q) => q?.type === QuestionType.OpenText && q?.id === filter?.questionType?.id
            )?.id;
            if (filter?.filterType?.filterComboBoxValue) {
              if (questionID) {
                const responseValue = response.data[questionID];
                if (filter?.filterType?.filterComboBoxValue === "Filled out") {
                  return typeof responseValue === "string" && responseValue.trim() !== "" ? true : false;
                }
                if (filter?.filterType?.filterComboBoxValue === "Skipped") {
                  return typeof responseValue === "string" && responseValue.trim() === "" ? true : false;
                }
                return true;
              }
              return false;
            }
            return true;
          });
          break;
        case QuestionType.CTA:
          toBeFilterResponses = toBeFilterResponses.filter((response) => {
            const questionID = response.questions.find(
              (q) => q?.type === QuestionType.CTA && q?.id === filter?.questionType?.id
            )?.id;
            if (filter?.filterType?.filterComboBoxValue) {
              if (questionID) {
                const responseValue = response.data[questionID];
                if (filter?.filterType?.filterComboBoxValue === "Clicked") {
                  return responseValue === "clicked";
                }
                if (filter?.filterType?.filterComboBoxValue === "Dismissed") {
                  return responseValue === "dismissed";
                }
                return true;
              }
              return false;
            }
            return true;
          });
          break;
        case QuestionType.MultipleChoiceMulti:
          toBeFilterResponses = toBeFilterResponses.filter((response) => {
            const question = response.questions.find(
              (q) => q?.type === QuestionType.MultipleChoiceMulti && q?.id === filter?.questionType?.id
            );
            if (filter?.filterType?.filterComboBoxValue) {
              if (question) {
                const responseValue = response.data[question.id];
                const filterValue = filter?.filterType?.filterComboBoxValue;
                if (Array.isArray(responseValue) && Array.isArray(filterValue) && filterValue.length > 0) {
                  //@ts-ignore
                  const updatedResponseValue = question?.choices
                    ? //@ts-ignore
                      matchAndUpdateArray([...question?.choices], [...responseValue])
                    : responseValue;
                  if (filter?.filterType?.filterValue === "Includes all") {
                    return filterValue.every((item) => updatedResponseValue.includes(item));
                  }
                  if (filter?.filterType?.filterValue === "Includes either") {
                    return filterValue.some((item) => updatedResponseValue.includes(item));
                  }
                }
                return true;
              }
              return false;
            }
            return true;
          });
          break;
        case QuestionType.MultipleChoiceSingle:
          toBeFilterResponses = toBeFilterResponses.filter((response) => {
            const questionID = response.questions.find(
              (q) => q?.type === QuestionType.MultipleChoiceSingle && q?.id === filter?.questionType?.id
            )?.id;
            if (filter?.filterType?.filterComboBoxValue) {
              if (questionID) {
                const responseValue = response.data[questionID];
                const filterValue = filter?.filterType?.filterComboBoxValue;
                if (
                  filter?.filterType?.filterValue === "Includes either" &&
                  Array.isArray(filterValue) &&
                  filterValue.length > 0 &&
                  typeof responseValue === "string"
                ) {
                  return filterValue.includes(responseValue);
                }
                return true;
              }
              return false;
            }
            return true;
          });
          break;
        case QuestionType.NPS:
          toBeFilterResponses = toBeFilterResponses.filter((response) => {
            const questionID = response.questions.find(
              (q) => q?.type === QuestionType.NPS && q?.id === filter?.questionType?.id
            )?.id;
            const responseValue = questionID ? response.data[questionID] : undefined;
            const filterValue =
              filter?.filterType?.filterComboBoxValue &&
              typeof filter?.filterType?.filterComboBoxValue === "string" &&
              parseInt(filter?.filterType?.filterComboBoxValue);
            if (filter?.filterType?.filterValue === "Submitted") {
              return responseValue ? true : false;
            }
            if (filter?.filterType?.filterValue === "Skipped") {
              return responseValue === "dismissed";
            }
            if (!questionID && typeof filterValue === "number") {
              return false;
            }
            if (questionID && typeof responseValue === "number" && typeof filterValue === "number") {
              if (filter?.filterType?.filterValue === "Is equal to") {
                return responseValue === filterValue;
              }
              if (filter?.filterType?.filterValue === "Is more than") {
                return responseValue > filterValue;
              }
              if (filter?.filterType?.filterValue === "Is less than") {
                return responseValue < filterValue;
              }
            }
            return true;
          });
          break;
        case QuestionType.Rating:
          toBeFilterResponses = toBeFilterResponses.filter((response) => {
            const questionID = response.questions.find(
              (q) => q?.type === QuestionType.Rating && q?.id === filter?.questionType?.id
            )?.id;
            const responseValue = questionID ? response.data[questionID] : undefined;
            const filterValue =
              filter?.filterType?.filterComboBoxValue &&
              typeof filter?.filterType?.filterComboBoxValue === "string" &&
              parseInt(filter?.filterType?.filterComboBoxValue);
            if (filter?.filterType?.filterValue === "Submitted") {
              return responseValue ? true : false;
            }
            if (filter?.filterType?.filterValue === "Skipped") {
              return responseValue === "dismissed";
            }
            if (!questionID && typeof filterValue === "number") {
              return false;
            }
            if (questionID && typeof responseValue === "number" && typeof filterValue === "number") {
              if (filter?.filterType?.filterValue === "Is equal to") {
                return responseValue === filterValue;
              }
              if (filter?.filterType?.filterValue === "Is more than") {
                return responseValue > filterValue;
              }
              if (filter?.filterType?.filterValue === "Is less than") {
                return responseValue < filterValue;
              }
            }
            return true;
          });
          break;
      }
    }
    if (filter.questionType?.type === "Tags") {
      toBeFilterResponses = toBeFilterResponses.filter((response) => {
        const tagNames = response.tags.map((tag) => tag.name);
        if (filter?.filterType?.filterComboBoxValue) {
          if (filter?.filterType?.filterComboBoxValue === "Applied") {
            if (filter?.questionType?.label) return tagNames.includes(filter.questionType.label);
          }
          if (filter?.filterType?.filterComboBoxValue === "Not applied") {
            if (filter?.questionType?.label) return !tagNames.includes(filter?.questionType?.label);
          }
        }
        return true;
      });
    }
    if (filter.questionType?.type === "Attributes") {
      toBeFilterResponses = toBeFilterResponses.filter((response) => {
        if (filter?.questionType?.label && filter?.filterType?.filterComboBoxValue) {
          const attributes =
            response.personAttributes && Object.keys(response.personAttributes).length > 0
              ? response.personAttributes
              : null;
          if (attributes && attributes.hasOwnProperty(filter?.questionType?.label)) {
            if (filter?.filterType?.filterValue === "Equals") {
              return attributes[filter?.questionType?.label] === filter?.filterType?.filterComboBoxValue;
            }
            if (filter?.filterType?.filterValue === "Not equals") {
              return attributes[filter?.questionType?.label] !== filter?.filterType?.filterComboBoxValue;
            }
          } else {
            return false;
          }
        }
        return true;
      });
    }
  });

  // filtering for the responses which is completed
  toBeFilterResponses = toBeFilterResponses.filter((r) => (selectedFilter.onlyComplete ? r.finished : true));

  // filtering the data according to the dates
  if (dateRange?.from !== undefined && dateRange?.to !== undefined) {
    // @ts-ignore
    toBeFilterResponses = toBeFilterResponses.filter((r) =>
      isWithinInterval(r.createdAt, { start: dateRange.from!, end: dateRange.to! })
    );
  }

  return toBeFilterResponses;
};

// get the today date with full hours
export const getTodayDate = (): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

// function update the response value of question multiChoiceSelect
function matchAndUpdateArray(choices: any, responseValue: string[]) {
  const choicesArray = choices.map((obj) => obj.label);

  responseValue.forEach((element, index) => {
    // Check if the element is present in the choices
    if (choicesArray.includes(element)) {
      return; // No changes needed, move to the next iteration
    }

    // Check if the choices has 'Other'
    if (choicesArray.includes("Other") && !choicesArray.includes(element)) {
      responseValue[index] = "Other"; // Update the element to 'Other'
    }
  });

  return responseValue;
}
