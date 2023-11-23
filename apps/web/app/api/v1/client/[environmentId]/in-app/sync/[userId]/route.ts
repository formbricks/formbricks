import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getLatestActionByPersonId } from "@formbricks/lib/action/service";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { IS_FORMBRICKS_CLOUD, PRICING_USERTARGETING_FREE_MTU } from "@formbricks/lib/constants";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import { createPerson, getPersonByUserId } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSyncSurveys } from "@formbricks/lib/survey/service";
import { getMonthlyActiveTeamPeopleCount, getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { TEnvironment } from "@formbricks/types/environment";
import { TJsState, ZJsPeopleUserIdInput } from "@formbricks/types/js";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: {
      environmentId: string;
      userId: string;
    };
  }
): Promise<NextResponse> {
  try {
    // validate using zod
    const inputValidation = ZJsPeopleUserIdInput.safeParse({
      environmentId: params.environmentId,
      userId: params.userId,
    });

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, userId } = inputValidation.data;

    let environment: TEnvironment | null;

    // check if environment exists
    environment = await getEnvironment(environmentId);
    if (!environment) {
      throw new Error("Environment does not exist");
    }
    if (!environment?.widgetSetupCompleted) {
      await updateEnvironment(environment.id, { widgetSetupCompleted: true });
    }

    // check if MAU limit is reached
    let isMauLimitReached = false;
    if (IS_FORMBRICKS_CLOUD) {
      // check team subscriptons
      const team = await getTeamByEnvironmentId(environmentId);

      if (!team) {
        throw new Error("Team does not exist");
      }
      const hasUserTargetingSubscription =
        team?.billing?.features.userTargeting.status &&
        team?.billing?.features.userTargeting.status in ["active", "canceled"];
      const currentMau = await getMonthlyActiveTeamPeopleCount(team.id);
      isMauLimitReached = !hasUserTargetingSubscription && currentMau >= PRICING_USERTARGETING_FREE_MTU;
    }

    let person = await getPersonByUserId(environmentId, userId);
    if (!isMauLimitReached) {
      if (!person) {
        person = await createPerson(environmentId, userId);
      }
    } else {
      const errorMessage = `Monthly Active Users limit in the current plan is reached in ${environmentId}`;
      if (!person) {
        // if it's a new person and MAU limit is reached, throw an error
        throw new Error(errorMessage);
      } else {
        // check if person has been active this month
        const latestAction = await getLatestActionByPersonId(person.id);
        if (!latestAction || new Date(latestAction.createdAt).getMonth() !== new Date().getMonth()) {
          throw new Error(errorMessage);
        }
      }
    }

    const [surveys, noCodeActionClasses, product] = await Promise.all([
      getSyncSurveys(environmentId, person),
      getActionClasses(environmentId),
      getProductByEnvironmentId(environmentId),
    ]);

    if (!product) {
      throw new Error("Product not found");
    }

    // return state
    const state: TJsState = {
      person,
      surveys,
      noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
      product,
    };

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
}
