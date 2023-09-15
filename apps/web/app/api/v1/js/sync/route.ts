import { getSurveys } from "@/app/api/v1/js/surveys";
import { responses } from "@/lib/api/response";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { transformErrorToDetails } from "@/lib/api/validator";
import { getActionClasses } from "@formbricks/lib/services/actionClass";
import { createPerson, getPerson } from "@formbricks/lib/services/person";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { createSession, extendSession, getSession } from "@formbricks/lib/services/session";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { TJsState, ZJsSyncInput } from "@formbricks/types/v1/js";
import { TPerson } from "@formbricks/types/v1/people";
import { TSession } from "@formbricks/types/v1/sessions";
import { NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { getEnvironment } from "@formbricks/lib/services/environment";

const captureNewSessionTelemetry = async (jsVersion?: string): Promise<void> => {
  await captureTelemetry("session created", { jsVersion: jsVersion ?? "unknown" });
};

const getEnvironmentCacheKey = (environmentId: string): string[] => ["environment", environmentId];
const getPersonCacheKey = (personId: string): string[] => ["person", personId];
const getSessionCacheKey = (sessionId: string): string[] => ["session", sessionId];
const getEnvironmentAndPersonCacheKey = (environmentId: string, personId: string): string[] => [
  "environment",
  environmentId,
  "person",
  personId,
];

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsSyncInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, personId, sessionId } = inputValidation.data;

    // check if environment exists
    const getEnvironmentCached = unstable_cache(
      async (environmentId: string) => {
        return await getEnvironment(environmentId);
      },
      getEnvironmentCacheKey(environmentId),
      {
        tags: getEnvironmentCacheKey(environmentId),
      }
    );

    const environment = await getEnvironmentCached(environmentId);

    if (!environment) {
      return responses.badRequestResponse(
        "Environment does not exist",
        { environmentId: "Environment with this ID does not exist" },
        true
      );
    }

    if (!personId) {
      // create a new person
      const person = await createPerson(environmentId);

      // create a new session
      const session = await createSession(person.id);

      // get/create rest of the state
      const getPersonStateCached = unstable_cache(
        async () => {
          return await Promise.all([
            getSurveys(environmentId, person),
            getActionClasses(environmentId),
            getProductByEnvironmentId(environmentId),
          ]);
        },
        getEnvironmentAndPersonCacheKey(environmentId, person.id),
        {
          tags: getEnvironmentAndPersonCacheKey(environmentId, person.id),
        }
      );

      const [surveys, noCodeActionClasses, product] = await getPersonStateCached();

      captureNewSessionTelemetry(inputValidation.data.jsVersion);

      if (!product) {
        return responses.notFoundResponse("ProductByEnvironmentId", environmentId, true);
      }

      // return state
      const state: TJsState = {
        person,
        session,
        surveys,
        noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
        product,
      };
      return responses.successResponse({ ...state }, true);
    }

    if (!sessionId) {
      let person: TPerson | null;
      // check if person exists

      const getPersonCached = unstable_cache(
        async (personId: string) => {
          return await getPerson(personId);
        },
        getPersonCacheKey(personId),
        {
          tags: getPersonCacheKey(personId),
        }
      );

      person = await getPersonCached(personId);
      if (!person) {
        // create a new person
        person = await createPerson(environmentId);
      }

      // create a new session
      const session = await createSession(person.id);

      const getSurveysCached = unstable_cache(
        async (environmentId: string, person: TPerson) => {
          return await getSurveys(environmentId, person);
        },
        getEnvironmentAndPersonCacheKey(environmentId, person.id),
        {
          tags: getEnvironmentAndPersonCacheKey(environmentId, person.id),
        }
      );

      const getActionClassesCached = unstable_cache(
        async (environmentId: string) => {
          return await getActionClasses(environmentId);
        },
        getEnvironmentCacheKey(environmentId),
        {
          tags: getEnvironmentCacheKey(environmentId),
        }
      );

      const getProductByEnvironmentIdCached = unstable_cache(
        async (environmentId: string) => {
          return await getProductByEnvironmentId(environmentId);
        },
        getEnvironmentCacheKey(environmentId),
        {
          tags: getEnvironmentCacheKey(environmentId),
        }
      );

      const [surveys, noCodeActionClasses, product] = await Promise.all([
        getSurveysCached(environmentId, person),
        getActionClassesCached(environmentId),
        getProductByEnvironmentIdCached(environmentId),
      ]);

      // const getPersonStateCached = unstable_cache(
      //   async (person: TPerson, environmentId: string) => {
      //     return await Promise.all([
      //       createSession(person.id),
      //       getSurveys(environmentId, person),
      //       getActionClasses(environmentId),
      //       getProductByEnvironmentId(environmentId),
      //     ]);
      //   },
      //   [person.id, environmentId],
      //   {
      //     tags: [person.id, environmentId],
      //   }
      // );

      // const [session, surveys, noCodeActionClasses, product] = await getPersonStateCached(
      //   person,
      //   environmentId
      // );

      if (!product) {
        return responses.notFoundResponse("ProductByEnvironmentId", environmentId, true);
      }

      captureNewSessionTelemetry(inputValidation.data.jsVersion);

      // return state
      const state: TJsState = {
        person,
        session,
        surveys,
        noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
        product,
      };

      return responses.successResponse({ ...state }, true);
    }
    // person & session exists

    // check if session exists
    let person: TPerson | null;
    let session: TSession | null;

    const getSessionCached = unstable_cache(
      async (sessionId: string) => {
        return await getSession(sessionId);
      },
      getSessionCacheKey(sessionId),
      {
        tags: getSessionCacheKey(sessionId),
      }
    );

    session = await getSessionCached(sessionId);

    if (!session) {
      // check if person exits

      const getPersonCached = unstable_cache(
        async (personId: string) => {
          return await getPerson(personId);
        },
        getPersonCacheKey(personId),
        {
          tags: getPersonCacheKey(personId),
        }
      );

      person = await getPersonCached(personId);

      if (!person) {
        // create a new person
        person = await createPerson(environmentId);
      }
      // create a new session
      session = await createSession(person.id);
      captureNewSessionTelemetry(inputValidation.data.jsVersion);
    } else {
      // session exists
      // check if person exists (should always exist, but just in case)
      const getPersonCached = unstable_cache(
        async (personId: string) => {
          return await getPerson(personId);
        },
        getPersonCacheKey(personId),
        {
          tags: getPersonCacheKey(personId),
        }
      );

      person = await getPersonCached(personId);
      if (!person) {
        // create a new person & session
        person = await createPerson(environmentId);
        session = await createSession(person.id);
      } else {
        // check if session is expired
        if (session.expiresAt < new Date()) {
          // create a new session
          session = await createSession(person.id);
          captureNewSessionTelemetry(inputValidation.data.jsVersion);
        } else {
          // extend session

          const isSessionAboutToExpire =
            new Date(session.expiresAt).getTime() - new Date().getTime() < 1000 * 60 * 10;

          if (isSessionAboutToExpire) {
            session = await extendSession(sessionId);

            revalidateTag(sessionId);
          }
        }
      }
    }

    const getSurveysCached = unstable_cache(
      async (environmentId: string, person: TPerson) => {
        return await getSurveys(environmentId, person);
      },
      getEnvironmentAndPersonCacheKey(environmentId, person.id),
      {
        tags: getEnvironmentAndPersonCacheKey(environmentId, person.id),
      }
    );

    const getActionClassesCached = unstable_cache(
      async (environmentId: string) => {
        return await getActionClasses(environmentId);
      },
      getEnvironmentCacheKey(environmentId),
      {
        tags: getEnvironmentCacheKey(environmentId),
      }
    );

    const getProductByEnvironmentIdCached = unstable_cache(
      async (environmentId: string) => {
        return await getProductByEnvironmentId(environmentId);
      },
      getEnvironmentCacheKey(environmentId),
      {
        tags: getEnvironmentCacheKey(environmentId),
      }
    );

    // get/create rest of the state
    const [surveys, noCodeActionClasses, product] = await Promise.all([
      getSurveysCached(environmentId, person),
      getActionClassesCached(environmentId),
      getProductByEnvironmentIdCached(environmentId),
    ]);

    if (!product) {
      return responses.notFoundResponse("ProductByEnvironmentId", environmentId, true);
    }

    // return state
    const state: TJsState = {
      person,
      session,
      surveys,
      noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
      product,
    };
    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(
      "Unable to complete response. See server logs for details.",
      true
    );
  }
}
