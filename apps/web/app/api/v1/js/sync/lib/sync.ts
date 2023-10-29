import { getSyncSurveysCached } from "@/app/api/v1/js/sync/lib/surveys";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import {
  IS_FORMBRICKS_CLOUD,
  MAU_LIMIT,
  PRICING_APPSURVEYS_FREE_RESPONSES,
  PRICING_USERTARGETING_FREE_MTU,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { createPerson, getPerson } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { createSession, extendSession, getSession } from "@formbricks/lib/session/service";
import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeamByEnvironmentId,
} from "@formbricks/lib/team/service";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { TEnvironment } from "@formbricks/types/environment";
import { TJsState } from "@formbricks/types/js";
import { TPerson } from "@formbricks/types/people";
import { TSession } from "@formbricks/types/sessions";

const captureNewSessionTelemetry = async (jsVersion?: string): Promise<void> => {
  await captureTelemetry("session created", { jsVersion: jsVersion ?? "unknown" });
};

export const getUpdatedState = async (
  environmentId: string,
  personId?: string,
  sessionId?: string,
  jsVersion?: string
): Promise<TJsState> => {
  let environment: TEnvironment | null;
  let person: TPerson;
  let session: TSession | null;

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
      if (!personId || !sessionId) {
        // don't allow new people or sessions
        throw new Error(errorMessage);
      }
      const session = await getSession(sessionId);
      if (!session) {
        // don't allow new sessions
        throw new Error(errorMessage);
      }
      // check if session was created this month (user already active this month)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      if (new Date(session.createdAt) < firstDayOfMonth) {
        throw new Error(errorMessage);
      }
    }
  }

  if (!personId) {
    // create a new person
    person = await createPerson(environmentId);
    // create a new session
    session = await createSession(person.id);
  } else {
    // check if person exists
    const existingPerson = await getPerson(personId);
    if (!existingPerson) {
      // create a new person
      person = await createPerson(environmentId);
    } else {
      person = existingPerson;
    }
  }
  if (!sessionId) {
    // create a new session
    session = await createSession(person.id);
  } else {
    // check validity of person & session
    session = await getSession(sessionId);
    if (!session) {
      // create a new session
      session = await createSession(person.id);
      captureNewSessionTelemetry(jsVersion);
    } else {
      // check if session is expired
      if (session.expiresAt < new Date()) {
        // create a new session
        session = await createSession(person.id);
        captureNewSessionTelemetry(jsVersion);
      } else {
        // extend session (if about to expire)
        const isSessionAboutToExpire =
          new Date(session.expiresAt).getTime() - new Date().getTime() < 1000 * 60 * 10;

        if (isSessionAboutToExpire) {
          session = await extendSession(sessionId);
        }
      }
    }
  }
  // check if App Survey limit is reached
  let isAppSurveyLimitReached = false;
  if (IS_FORMBRICKS_CLOUD) {
    const hasAppSurveySubscription =
      team?.billing?.features.appSurvey.status &&
      team?.billing?.features.appSurvey.status in ["active", "canceled"];
    const monthlyResponsesCount = await getMonthlyTeamResponseCount(team.id);
    isAppSurveyLimitReached =
      IS_FORMBRICKS_CLOUD &&
      !hasAppSurveySubscription &&
      monthlyResponsesCount >= PRICING_APPSURVEYS_FREE_RESPONSES;
  }

  // get/create rest of the state
  const [surveys, noCodeActionClasses, product] = await Promise.all([
    !isAppSurveyLimitReached ? getSyncSurveysCached(environmentId, person) : [],
    getActionClasses(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  // return state
  const state: TJsState = {
    person: person!,
    session,
    surveys,
    noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
    product,
  };

  return state;
};
