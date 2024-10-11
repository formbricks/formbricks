import { replaceAttributeRecall } from "@/app/api/v1/client/[environmentId]/app/sync/lib/utils";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest, userAgent } from "next/server";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import { createPerson, getPersonByUserId } from "@formbricks/lib/person/service";
import {
  capturePosthogEnvironmentEvent,
  sendPlanLimitsReachedEventToPosthogWeekly,
} from "@formbricks/lib/posthogServer";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { getSyncSurveys } from "@formbricks/lib/survey/service";
import { TJsAppStateSync, ZJsPeopleUserIdInput } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/surveys/types";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  request: NextRequest,
  {
    params,
  }: {
    params: {
      environmentId: string;
      userId: string;
    };
  }
): Promise<Response> => {
  try {
    const { device } = userAgent(request);

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

    // check if response limit is reached
    let isAppSurveyResponseLimitReached = false;
    if (IS_FORMBRICKS_CLOUD) {
      const currentResponseCount = await getMonthlyOrganizationResponseCount(organization.id);
      const monthlyResponseLimit = organization.billing.limits.monthly.responses;

      isAppSurveyResponseLimitReached =
        monthlyResponseLimit !== null && currentResponseCount >= monthlyResponseLimit;

      if (isAppSurveyResponseLimitReached) {
        try {
          await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
            plan: organization.billing.plan,
            limits: { monthly: { responses: monthlyResponseLimit, miu: null } },
          });
        } catch (error) {
          console.error(`Error sending plan limits reached event to Posthog: ${error}`);
        }
      }
    }

    let person = await getPersonByUserId(environmentId, userId);

    if (!person) {
      person = await createPerson(environmentId, userId);
    }

    const [surveys, actionClasses] = await Promise.all([
      getSyncSurveys(environmentId, person.id, device.type === "mobile" ? "phone" : "desktop"),
      getActionClasses(environmentId),
    ]);

    if (!product) {
      throw new Error("Product not found");
    }

    const updatedProduct: any = {
      ...product,
      brandColor: product.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
      ...(product.styling.highlightBorderColor?.light && {
        highlightBorderColor: product.styling.highlightBorderColor.light,
      }),
    };
    const attributes = await getAttributes(person.id);
    const language = attributes["language"];

    // Scenario 1: Multi language and updated trigger action classes supported.
    // Use the surveys as they are.
    let transformedSurveys: TSurvey[] = surveys;

    // creating state object
    let state: TJsAppStateSync = {
      surveys: !isAppSurveyResponseLimitReached
        ? transformedSurveys.map((survey) => replaceAttributeRecall(survey, attributes))
        : [],
      actionClasses,
      language,
      product: updatedProduct,
    };

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
