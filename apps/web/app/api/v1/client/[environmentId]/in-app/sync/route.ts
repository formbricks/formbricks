import { getFirstSurvey } from "@/app/(app)/environments/[environmentId]/surveys/templates/templates";
import { sendFreeLimitReachedEventToPosthogBiWeekly } from "@/app/api/v1/client/[environmentId]/in-app/sync/lib/posthog";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";

import { getActionClasses } from "@formbricks/lib/actionClass/service";
import {
  IS_FORMBRICKS_CLOUD,
  PRICING_APPSURVEYS_FREE_RESPONSES,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { createSurvey, getSurveys } from "@formbricks/lib/survey/service";
import { getMonthlyTeamResponseCount, getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { TJsStateSync, ZJsPublicSyncInput } from "@formbricks/types/js";

export async function OPTIONS(): Promise<Response> {
  return responses.successResponse({}, true);
}

export async function GET(
  _: NextRequest,
  { params }: { params: { environmentId: string } }
): Promise<Response> {
  try {
    // validate using zod
    const environmentIdValidation = ZJsPublicSyncInput.safeParse({
      environmentId: params.environmentId,
    });

    if (!environmentIdValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(environmentIdValidation.error),
        true
      );
    }

    const { environmentId } = environmentIdValidation.data;

    const environment = await getEnvironment(environmentId);

    if (!environment) {
      throw new Error("Environment does not exist");
    }

    // check if MAU limit is reached
    let isInAppSurveyLimitReached = false;
    if (IS_FORMBRICKS_CLOUD) {
      // check team subscriptons
      const team = await getTeamByEnvironmentId(environmentId);

      if (!team) {
        throw new Error("Team does not exist");
      }
      // check inAppSurvey subscription
      const hasInAppSurveySubscription =
        team.billing.features.inAppSurvey.status &&
        ["active", "canceled"].includes(team.billing.features.inAppSurvey.status);
      const currentResponseCount = await getMonthlyTeamResponseCount(team.id);
      isInAppSurveyLimitReached =
        !hasInAppSurveySubscription && currentResponseCount >= PRICING_APPSURVEYS_FREE_RESPONSES;
      if (isInAppSurveyLimitReached) {
        await sendFreeLimitReachedEventToPosthogBiWeekly(environmentId, "inAppSurvey");
      }
    }

    if (!environment?.widgetSetupCompleted) {
      const firstSurvey = getFirstSurvey(WEBAPP_URL);
      await createSurvey(environmentId, firstSurvey);
      await updateEnvironment(environment.id, { widgetSetupCompleted: true });
    }

    const [surveys, noCodeActionClasses, product] = await Promise.all([
      getSurveys(environmentId),
      getActionClasses(environmentId),
      getProductByEnvironmentId(environmentId),
    ]);

    if (!product) {
      throw new Error("Product not found");
    }

    const state: TJsStateSync = {
      surveys: !isInAppSurveyLimitReached
        ? surveys.filter(
            (survey) =>
              survey.status === "inProgress" &&
              survey.type === "web" &&
              (!survey.segment || survey.segment.filters.length === 0)
          )
        : [],
      noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
      product,
      person: null,
    };

    return responses.successResponse(
      { ...state },
      true,
      "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
    );
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
}
