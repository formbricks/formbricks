import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import {
  capturePosthogEnvironmentEvent,
  sendPlanLimitsReachedEventToPosthogWeekly,
} from "@formbricks/lib/posthogServer";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TJsEnvironmentState, ZJsSyncInput } from "@formbricks/types/js";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  _: NextRequest,
  {
    params,
  }: {
    params: {
      environmentId: string;
    };
  }
): Promise<Response> => {
  try {
    // validate using zod
    const inputValidation = ZJsSyncInput.safeParse({
      environmentId: params.environmentId,
    });

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId } = inputValidation.data;

    const environment = await getEnvironment(environmentId);
    if (!environment) {
      throw new Error("Environment does not exist");
    }

    const product = await getProductByEnvironmentId(environmentId);

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.config.channel && product.config.channel !== "app") {
      return responses.forbiddenResponse("Product channel is not app", true);
    }

    if (!environment.appSetupCompleted) {
      await Promise.all([
        updateEnvironment(environment.id, { appSetupCompleted: true }),
        capturePosthogEnvironmentEvent(environmentId, "app setup completed"),
      ]);
    }

    // check organization subscriptions
    const organization = await getOrganizationByEnvironmentId(environmentId);

    if (!organization) {
      throw new Error("Organization does not exist");
    }

    // check if MAU limit is reached
    let isMonthlyResponsesLimitReached = false;

    if (IS_FORMBRICKS_CLOUD) {
      const monthlyResponseLimit = organization.billing.limits.monthly.responses;

      const currentResponseCount = await getMonthlyOrganizationResponseCount(organization.id);
      isMonthlyResponsesLimitReached =
        monthlyResponseLimit !== null && currentResponseCount >= monthlyResponseLimit;
    }

    if (isMonthlyResponsesLimitReached) {
      try {
        await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
          plan: organization.billing.plan,
          limits: {
            monthly: {
              miu: organization.billing.limits.monthly.miu,
              responses: organization.billing.limits.monthly.responses,
            },
          },
        });
      } catch (err) {
        console.error(`Error sending plan limits reached event to Posthog: ${err}`);
      }
    }

    const [surveys, actionClasses] = await Promise.all([
      getSurveys(environmentId),
      getActionClasses(environmentId),
    ]);

    const filteredSurveys = surveys.filter(
      (survey) => survey.type === "app" && survey.status === "inProgress"
    );

    const updatedProduct: any = {
      ...product,
      brandColor: product.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
      ...(product.styling.highlightBorderColor?.light && {
        highlightBorderColor: product.styling.highlightBorderColor.light,
      }),
    };

    const state: TJsEnvironmentState["data"] = {
      surveys: !isMonthlyResponsesLimitReached ? filteredSurveys : [],
      actionClasses,
      product: updatedProduct,
    };

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
