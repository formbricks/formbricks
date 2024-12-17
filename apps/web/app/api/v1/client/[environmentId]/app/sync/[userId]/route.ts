import { getContactByUserId } from "@/app/api/v1/client/[environmentId]/app/sync/lib/contact";
import { getSyncSurveys } from "@/app/api/v1/client/[environmentId]/app/sync/lib/survey";
import { replaceAttributeRecall } from "@/app/api/v1/client/[environmentId]/app/sync/lib/utils";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { contactCache } from "@/lib/cache/contact";
import { NextRequest, userAgent } from "next/server";
import { prisma } from "@formbricks/database";
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
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { TJsRNStateSync, ZJsPeopleUserIdInput } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/surveys/types";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  request: NextRequest,
  props: {
    params: Promise<{
      environmentId: string;
      userId: string;
    }>;
  }
): Promise<Response> => {
  const params = await props.params;
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

    const project = await getProjectByEnvironmentId(environmentId);

    if (!project) {
      throw new Error("Project not found");
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
            limits: {
              projects: null,
              monthly: {
                responses: monthlyResponseLimit,
                miu: null,
              },
            },
          });
        } catch (error) {
          console.error(`Error sending plan limits reached event to Posthog: ${error}`);
        }
      }
    }

    let contact = await getContactByUserId(environmentId, userId);
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          attributes: {
            create: {
              attributeKey: {
                connect: {
                  key_environmentId: {
                    key: "userId",
                    environmentId,
                  },
                },
              },
              value: userId,
            },
          },
          environment: { connect: { id: environmentId } },
        },
        select: {
          id: true,
          attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
        },
      });

      if (contact) {
        contactCache.revalidate({
          userId: contact.attributes.find((attr) => attr.attributeKey.key === "userId")?.value,
          id: contact.id,
          environmentId,
        });
      }
    }

    const contactAttributes = contact.attributes.reduce((acc, attribute) => {
      acc[attribute.attributeKey.key] = attribute.value;
      return acc;
    }, {}) as Record<string, string>;

    const [surveys, actionClasses] = await Promise.all([
      getSyncSurveys(
        environmentId,
        contact.id,
        contactAttributes,
        device.type === "mobile" ? "phone" : "desktop"
      ),
      getActionClasses(environmentId),
    ]);

    if (!project) {
      throw new Error("Project not found");
    }

    const updatedProject: any = {
      ...project,
      brandColor: project.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
      ...(project.styling.highlightBorderColor?.light && {
        highlightBorderColor: project.styling.highlightBorderColor.light,
      }),
    };

    const language = contactAttributes["language"];

    // Scenario 1: Multi language and updated trigger action classes supported.
    // Use the surveys as they are.
    let transformedSurveys: TSurvey[] = surveys;

    // creating state object
    let state: TJsRNStateSync = {
      surveys: !isAppSurveyResponseLimitReached
        ? transformedSurveys.map((survey) => replaceAttributeRecall(survey, contactAttributes))
        : [],
      actionClasses,
      language,
      project: updatedProject,
    };

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
