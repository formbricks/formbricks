import { getSurveysCached } from "@/app/api/v1/js/surveys";
import { MAU_LIMIT } from "@formbricks/lib/constants";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { createPerson, getMonthlyActivePeopleCount, getPersonCached } from "@formbricks/lib/person/service";
import { getProductByEnvironmentIdCached } from "@formbricks/lib/product/service";
import { createSession, extendSession, getSessionCached } from "@formbricks/lib/session/service";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TJsState } from "@formbricks/types/v1/js";
import { TPerson } from "@formbricks/types/v1/people";
import { TSession } from "@formbricks/types/v1/sessions";

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

  // check if Monthly Active Users limit is reached
  const currentMau = await getMonthlyActivePeopleCount(environmentId);
  const isMauLimitReached = currentMau >= MAU_LIMIT;
  if (isMauLimitReached) {
    const errorMessage = `Monthly Active Users limit reached in ${environmentId} (${currentMau}/${MAU_LIMIT})`;
    if (!personId || !sessionId) {
      // don't allow new people or sessions
      throw new Error(errorMessage);
    }
    const session = await getSessionCached(sessionId);
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

  if (!personId) {
    // create a new person
    person = await createPerson(environmentId);
    // create a new session
    session = await createSession(person.id);
  } else {
    // check if person exists
    const existingPerson = await getPersonCached(personId);
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
    session = await getSessionCached(sessionId);
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
  // we now have a valid person & session

  // get/create rest of the state
  const [surveys, noCodeActionClasses, product] = await Promise.all([
    getSurveysCached(environmentId, person),
    getActionClasses(environmentId),
    getProductByEnvironmentIdCached(environmentId),
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
