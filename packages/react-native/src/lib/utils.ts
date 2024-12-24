/**
 * Filters surveys based on the displayOption, recontactDays, and segments
 * @param environmentSate - The environment state
 * @param personState - The person state
 * @returns The filtered surveys
 */
import { diffInDays } from "@formbricks/lib/utils/datetime";
import {
  type TJsEnvironmentState,
  type TJsEnvironmentStateSurvey,
  type TJsPersonState,
} from "@formbricks/types/js";

// takes the environment and person state and returns the filtered surveys
export const filterSurveys = (
  environmentState: TJsEnvironmentState,
  personState: TJsPersonState
): TJsEnvironmentStateSurvey[] => {
  const { project, surveys } = environmentState.data;
  const { displays, responses, lastDisplayAt, segments, userId } = personState.data;

  // Function to filter surveys based on displayOption criteria
  let filteredSurveys = surveys.filter((survey: TJsEnvironmentStateSurvey) => {
    switch (survey.displayOption) {
      case "respondMultiple":
        return true;
      case "displayOnce":
        return displays.filter((display) => display.surveyId === survey.id).length === 0;
      case "displayMultiple":
        return responses.filter((surveyId) => surveyId === survey.id).length === 0;

      case "displaySome":
        if (survey.displayLimit === null) {
          return true;
        }

        // Check if survey response exists, if so, stop here
        if (responses.filter((surveyId) => surveyId === survey.id).length) {
          return false;
        }

        // Otherwise, check if displays length is less than displayLimit
        return displays.filter((display) => display.surveyId === survey.id).length < survey.displayLimit;

      default:
        throw Error("Invalid displayOption");
    }
  });

  // filter surveys that meet the recontactDays criteria
  filteredSurveys = filteredSurveys.filter((survey) => {
    // if no survey was displayed yet, show the survey
    if (!lastDisplayAt) {
      return true;
    }
    // if survey has recontactDays, check if the last display was more than recontactDays ago
    else if (survey.recontactDays !== null) {
      const lastDisplaySurvey = displays.filter((display) => display.surveyId === survey.id)[0];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- lastDisplaySurvey could be falsy
      if (!lastDisplaySurvey) {
        return true;
      }
      return diffInDays(new Date(), new Date(lastDisplaySurvey.createdAt)) >= survey.recontactDays;
    }
    // use recontactDays of the project if survey does not have recontactDays
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- recontactDays could be falsy
    else if (project.recontactDays !== null) {
      return diffInDays(new Date(), new Date(lastDisplayAt)) >= project.recontactDays;
    }

    // if no recontactDays is set, show the survey
    return true;
  });

  if (!userId) {
    return filteredSurveys;
  }

  if (!segments.length) {
    return [];
  }

  // filter surveys based on segments
  return filteredSurveys.filter((survey) => {
    return survey.segment?.id && segments.includes(survey.segment.id);
  });
};
