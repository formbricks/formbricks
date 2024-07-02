import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { reverseTranslateSurvey } from "@formbricks/lib/i18n/reverseTranslation";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import { getPerson } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { getSurveys, getSyncSurveys } from "@formbricks/lib/survey/service";
import { TEnvironment } from "@formbricks/types/environment";
import { TJsLegacyState, TSurveyWithTriggers } from "@formbricks/types/js";
import { TPerson } from "@formbricks/types/people";
import { TProductLegacy } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys/types";

export const transformLegacySurveys = (surveys: TSurvey[]): TSurveyWithTriggers[] => {
  const updatedSurveys = surveys.map((survey) => {
    const updatedSurvey: any = { ...reverseTranslateSurvey(survey) };
    updatedSurvey.triggers = updatedSurvey.triggers.map((trigger) => ({ name: trigger.actionClass.name }));
    return updatedSurvey;
  });
  return updatedSurveys;
};

export const getUpdatedState = async (environmentId: string, personId?: string): Promise<TJsLegacyState> => {
  let environment: TEnvironment | null;
  let person: TPerson | {};
  const session = {};

  // check if environment exists
  environment = await getEnvironment(environmentId);

  if (!environment) {
    throw new Error("Environment does not exist");
  }

  // check organization subscriptons
  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("Organization does not exist");
  }

  // check if Monthly Active Users limit is reached
  if (IS_FORMBRICKS_CLOUD) {
    const currentMau = await getMonthlyActiveOrganizationPeopleCount(organization.id);
    const monthlyMiuLimit = organization.billing.limits.monthly.miu;

    const isMauLimitReached = monthlyMiuLimit !== null && currentMau >= monthlyMiuLimit;

    if (isMauLimitReached) {
      const errorMessage = `Monthly Active Users limit reached in ${environmentId}`;
      if (!personId) {
        // don't allow new people or sessions
        throw new Error(errorMessage);
      }
    }
  }

  if (!personId) {
    // create a new person
    person = { id: "legacy" };
  } else {
    // check if person exists
    const existingPerson = await getPerson(personId);
    if (existingPerson) {
      person = existingPerson;
    } else {
      person = { id: "legacy" };
    }
  }

  // check if responses limit is reached
  let isResponsesLimitReached = false;
  if (IS_FORMBRICKS_CLOUD) {
    const monthlyResponsesCount = await getMonthlyOrganizationResponseCount(organization.id);
    const monthlyResponseLimit = organization.billing.limits.monthly.responses;
    isResponsesLimitReached = monthlyResponseLimit !== null && monthlyResponsesCount >= monthlyResponseLimit;
  }

  const isPerson = Object.keys(person).length > 0;

  let surveys;

  if (isResponsesLimitReached) {
    surveys = [];
  } else if (isPerson) {
    surveys = await getSyncSurveys(environmentId, (person as TPerson).id);
  } else {
    surveys = await getSurveys(environmentId);
    surveys = surveys.filter(
      (survey) => (survey.type === "app" || survey.type === "website") && survey.status === "inProgress"
    );
  }

  surveys = transformLegacySurveys(surveys);

  // get/create rest of the state
  const [noCodeActionClasses, product] = await Promise.all([
    getActionClasses(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  const updatedProduct: TProductLegacy = {
    ...product,
    brandColor: product.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
    ...(product.styling.highlightBorderColor?.light && {
      highlightBorderColor: product.styling.highlightBorderColor.light,
    }),
  };

  // return state
  const state: TJsLegacyState = {
    person,
    session,
    surveys,
    noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
    product: updatedProduct,
  };

  return state;
};
