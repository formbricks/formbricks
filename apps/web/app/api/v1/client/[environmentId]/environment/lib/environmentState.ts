import { prisma } from "@formbricks/database";
import { actionClassCache } from "@formbricks/lib/actionClass/cache";
import { cache } from "@formbricks/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { organizationCache } from "@formbricks/lib/organization/cache";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import {
  capturePosthogEnvironmentEvent,
  sendPlanLimitsReachedEventToPosthogWeekly,
} from "@formbricks/lib/posthogServer";
import { projectCache } from "@formbricks/lib/project/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsEnvironmentState } from "@formbricks/types/js";
import { getActionClassesForEnvironmentState } from "./actionClass";
import { getProjectForEnvironmentState } from "./project";
import { getSurveysForEnvironmentState } from "./survey";

/**
 *
 * @param environmentId
 * @returns The environment state
 * @throws ResourceNotFoundError if the environment or organization does not exist
 */
export const getEnvironmentState = async (
  environmentId: string
): Promise<{ data: TJsEnvironmentState["data"]; revalidateEnvironment?: boolean }> =>
  cache(
    async () => {
      let revalidateEnvironment = false;
      const [environment, organization, project] = await Promise.all([
        getEnvironment(environmentId),
        getOrganizationByEnvironmentId(environmentId),
        getProjectForEnvironmentState(environmentId),
      ]);

      if (!environment) {
        throw new ResourceNotFoundError("environment", environmentId);
      }

      if (!organization) {
        throw new ResourceNotFoundError("organization", null);
      }

      if (!project) {
        throw new ResourceNotFoundError("project", null);
      }

      if (!environment.appSetupCompleted) {
        await Promise.all([
          prisma.environment.update({
            where: {
              id: environmentId,
            },
            data: { appSetupCompleted: true },
          }),
          capturePosthogEnvironmentEvent(environmentId, "app setup completed"),
        ]);

        revalidateEnvironment = true;
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
              projects: null,
              monthly: {
                miu: null,
                responses: organization.billing.limits.monthly.responses,
              },
            },
          });
        } catch (err) {
          logger.error(err, "Error sending plan limits reached event to Posthog");
        }
      }

      const [surveys, actionClasses] = await Promise.all([
        getSurveysForEnvironmentState(environmentId),
        getActionClassesForEnvironmentState(environmentId),
      ]);

      const filteredSurveys = surveys.filter(
        (survey) => survey.type === "app" && survey.status === "inProgress"
      );

      const data: TJsEnvironmentState["data"] = {
        surveys: !isMonthlyResponsesLimitReached ? filteredSurveys : [],
        actionClasses,
        project: project,
      };

      return {
        data,
        revalidateEnvironment,
      };
    },
    [`environmentState-${environmentId}`],
    {
      ...(IS_FORMBRICKS_CLOUD && { revalidate: 24 * 60 * 60 }),
      tags: [
        environmentCache.tag.byId(environmentId),
        organizationCache.tag.byEnvironmentId(environmentId),
        projectCache.tag.byEnvironmentId(environmentId),
        surveyCache.tag.byEnvironmentId(environmentId),
        actionClassCache.tag.byEnvironmentId(environmentId),
      ],
    }
  )();
