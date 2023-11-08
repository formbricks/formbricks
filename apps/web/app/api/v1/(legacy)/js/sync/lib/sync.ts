import { getSyncSurveysCached } from "@/app/api/v1/(legacy)/js/sync/lib/surveys";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import {
  IS_FORMBRICKS_CLOUD,
  MAU_LIMIT,
  PRICING_APPSURVEYS_FREE_RESPONSES,
  PRICING_USERTARGETING_FREE_MTU,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getPerson } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeamByEnvironmentId,
} from "@formbricks/lib/team/service";
import { TEnvironment } from "@formbricks/types/environment";
import { TJsLegacyState } from "@formbricks/types/js";
import { TPerson } from "@formbricks/types/people";

export const getUpdatedState = async (environmentId: string, personId?: string): Promise<TJsLegacyState> => {
  let environment: TEnvironment | null;
  let person: TPerson | {};
  const session = {};

  // check if environment exists
  environment = await getEnvironment(environmentId);

  if (!environment) {
    throw new Error("Environment does not exist");
  }

  // check team subscriptons
  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    throw new Error("Team does not exist");
  }

  // check if Monthly Active Users limit is reached
  if (IS_FORMBRICKS_CLOUD) {
    const hasUserTargetingSubscription =
      team?.billing?.features.userTargeting.status &&
      team?.billing?.features.userTargeting.status in ["active", "canceled"];
    const currentMau = await getMonthlyActiveTeamPeopleCount(team.id);
    const isMauLimitReached = !hasUserTargetingSubscription && currentMau >= PRICING_USERTARGETING_FREE_MTU;
    if (isMauLimitReached) {
      const errorMessage = `Monthly Active Users limit reached in ${environmentId} (${currentMau}/${MAU_LIMIT})`;
      if (!personId) {
        // don't allow new people or sessions
        throw new Error(errorMessage);
      }
    }
  }

  if (!personId) {
    // create a new person
    person = {};
  } else {
    // check if person exists
    const existingPerson = await getPerson(personId);
    if (existingPerson) {
      person = existingPerson;
    } else {
      person = {};
    }
  }
  // check if App Survey limit is reached
  let isAppSurveyLimitReached = false;
  if (IS_FORMBRICKS_CLOUD) {
    const hasAppSurveySubscription =
      team?.billing?.features.inAppSurvey.status &&
      team?.billing?.features.inAppSurvey.status in ["active", "canceled"];
    const monthlyResponsesCount = await getMonthlyTeamResponseCount(team.id);
    isAppSurveyLimitReached =
      IS_FORMBRICKS_CLOUD &&
      !hasAppSurveySubscription &&
      monthlyResponsesCount >= PRICING_APPSURVEYS_FREE_RESPONSES;
  }

  const isPerson = Object.keys(person).length > 0;

  let surveys;
  if (isAppSurveyLimitReached) {
    surveys = [];
  } else if (isPerson) {
    surveys = await getSyncSurveysCached(environmentId, person as TPerson);
  } else {
    surveys = await getSurveys(environmentId);
    surveys = surveys.filter((survey) => survey.type === "web");
  }

  // get/create rest of the state
  const [noCodeActionClasses, product] = await Promise.all([
    getActionClasses(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  // return state
  const state: TJsLegacyState = {
    person,
    session,
    surveys,
    noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
    product,
  };

  return state;
};
