import { getActionClasses } from "@formbricks/lib/actionClass/service";
import {
  IS_FORMBRICKS_CLOUD,
  MAU_LIMIT,
  PRICING_APPSURVEYS_FREE_RESPONSES,
  PRICING_USERTARGETING_FREE_MTU,
} from "@formbricks/lib/constants";
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
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

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
    const hasUserTargetingSubscription =
      organization?.billing?.features.userTargeting.status &&
      ["active", "canceled"].includes(organization?.billing?.features.userTargeting.status);
    const currentMau = await getMonthlyActiveOrganizationPeopleCount(organization.id);
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
  // check if App Survey limit is reached
  let isAppSurveyLimitReached = false;
  if (IS_FORMBRICKS_CLOUD) {
    const hasAppSurveySubscription =
      organization?.billing?.features.inAppSurvey.status &&
      ["active", "canceled"].includes(organization?.billing?.features.inAppSurvey.status);
    const monthlyResponsesCount = await getMonthlyOrganizationResponseCount(organization.id);
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

  const updatedProduct: TProduct = {
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
