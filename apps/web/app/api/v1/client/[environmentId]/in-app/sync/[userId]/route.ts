import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { IS_FORMBRICKS_CLOUD, MAU_LIMIT, PRICING_USERTARGETING_FREE_MTU } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrCreatePersonByUserId } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSyncSurveysCached } from "@formbricks/lib/survey/service";
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

    // check if person exists
    const person = await getOrCreatePersonByUserId(userId, environmentId);

    if (!person) {
      return responses.badRequestResponse(`Person with userId ${userId} not found`);
    }

    let environment: TEnvironment | null;

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

      // TODO: Problem is that if isMauLimitReached, all sync request will fail
      // But what we essentially want, is to fail only for new people syncing for the first time

      if (isMauLimitReached) {
        const errorMessage = `Monthly Active Users limit reached in ${environmentId} (${currentMau}/${MAU_LIMIT})`;
        throw new Error(errorMessage);
      }
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
