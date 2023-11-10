import { getSyncSurveysCached } from "@/app/api/v1/(legacy)/js/lib/surveys";
import { IS_FORMBRICKS_CLOUD, MAU_LIMIT, PRICING_USERTARGETING_FREE_MTU } from "@formbricks/lib/constants";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getPerson } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { TEnvironment } from "@formbricks/types/environment";
import { TJsLegacyState } from "@formbricks/types/js";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getMonthlyActiveTeamPeopleCount, getTeamByEnvironmentId } from "@formbricks/lib/team/service";

const captureNewSessionTelemetry = async (jsVersion?: string): Promise<void> => {
  await captureTelemetry("state update", { jsVersion: jsVersion ?? "unknown" });
};

export const getUpdatedState = async (
  environmentId: string,
  personId: string,
  jsVersion?: string
): Promise<TJsLegacyState> => {
  let environment: TEnvironment | null;

  if (jsVersion) {
    captureNewSessionTelemetry(jsVersion);
  }

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
      throw new Error(errorMessage);

      // if (!personId) {
      //   // don't allow new people
      //   throw new Error(errorMessage);
      // }
      // const session = await getSession(sessionId);
      // if (!session) {
      //   // don't allow new sessions
      //   throw new Error(errorMessage);
      // }
      // // check if session was created this month (user already active this month)
      // const now = new Date();
      // const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      // if (new Date(session.createdAt) < firstDayOfMonth) {
      //   throw new Error(errorMessage);
      // }
    }
  }

  const person = await getPerson(personId);

  if (!person) {
    throw new Error("Person not found");
  }

  const [surveys, noCodeActionClasses, product] = await Promise.all([
    getSyncSurveysCached(environmentId, person),
    getActionClasses(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  // return state
  const state: TJsLegacyState = {
    person: person!,
    session: {},
    surveys,
    noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
    product,
  };

  return state;
};

export const getPublicUpdatedState = async (environmentId: string) => {
  // check if environment exists
  const environment = await getEnvironment(environmentId);

  if (!environment) {
    throw new Error("Environment does not exist");
  }

  // TODO: check if Monthly Active Users limit is reached

  const [surveys, noCodeActionClasses, product] = await Promise.all([
    getSurveys(environmentId),
    getActionClasses(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  const state: TJsLegacyState = {
    surveys,
    session: {},
    noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
    product,
    person: null,
  };

  return state;
};
