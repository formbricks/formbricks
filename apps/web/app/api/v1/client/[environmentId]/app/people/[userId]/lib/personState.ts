import { getPersonSegmentIds } from "@/app/api/v1/client/[environmentId]/app/people/[userId]/lib/segments";
import { attributeCache } from "@formbricks/lib/attribute/cache";
import { getAttributesByUserId } from "@formbricks/lib/attribute/service";
import { cache } from "@formbricks/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { displayCache } from "@formbricks/lib/display/cache";
import { getDisplaysByUserId } from "@formbricks/lib/display/service";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { organizationCache } from "@formbricks/lib/organization/cache";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import { personCache } from "@formbricks/lib/person/cache";
import { createPerson, getIsPersonMonthlyActive, getPersonByUserId } from "@formbricks/lib/person/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@formbricks/lib/posthogServer";
import { responseCache } from "@formbricks/lib/response/cache";
import { getResponsesByUserId } from "@formbricks/lib/response/service";
import { segmentCache } from "@formbricks/lib/segment/cache";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsPersonState } from "@formbricks/types/js";

/**
 *
 * @param environmentId - The environment id
 * @param userId - The user id
 * @param device - The device type
 * @returns The person state
 * @throws {ValidationError} - If the input is invalid
 * @throws {ResourceNotFoundError} - If the environment or organization is not found
 * @throws {OperationNotAllowedError} - If the MAU limit is reached and the person has not been active this month
 */
export const getPersonState = async ({
  environmentId,
  userId,
  device,
}: {
  environmentId: string;
  userId: string;
  device: "phone" | "desktop";
}): Promise<TJsPersonState["data"]> =>
  cache(
    async () => {
      const environment = await getEnvironment(environmentId);

      if (!environment) {
        throw new ResourceNotFoundError(`environment`, environmentId);
      }

      const organization = await getOrganizationByEnvironmentId(environmentId);

      if (!organization) {
        throw new ResourceNotFoundError(`organization`, environmentId);
      }

      let isMauLimitReached = false;
      if (IS_FORMBRICKS_CLOUD) {
        const currentMau = await getMonthlyActiveOrganizationPeopleCount(organization.id);
        const monthlyMiuLimit = organization.billing.limits.monthly.miu;

        isMauLimitReached = monthlyMiuLimit !== null && currentMau >= monthlyMiuLimit;
      }

      let person = await getPersonByUserId(environmentId, userId);

      if (isMauLimitReached) {
        // MAU limit reached: check if person has been active this month; only continue if person has been active

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

        const errorMessage = `Monthly Active Users limit in the current plan is reached in ${environmentId}`;
        if (!person) {
          // if it's a new person and MAU limit is reached, throw an error
          throw new OperationNotAllowedError(errorMessage);
        }

        // check if person has been active this month
        const isPersonMonthlyActive = await getIsPersonMonthlyActive(person.id);
        if (!isPersonMonthlyActive) {
          throw new OperationNotAllowedError(errorMessage);
        }
      } else {
        // MAU limit not reached: create person if not exists
        if (!person) {
          person = await createPerson(environmentId, userId);
        }
      }

      const personResponses = await getResponsesByUserId(environmentId, userId);
      const personDisplays = await getDisplaysByUserId(environmentId, userId);
      const segments = await getPersonSegmentIds(environmentId, person, device);
      const attributes = await getAttributesByUserId(environmentId, userId);

      // If the person exists, return the persons's state
      const userState: TJsPersonState["data"] = {
        userId: person.userId,
        segments,
        displays: personDisplays?.map((display) => display.surveyId) ?? [],
        responses: personResponses?.map((response) => response.surveyId) ?? [],
        attributes,
        lastDisplayAt:
          personDisplays.length > 0
            ? personDisplays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
            : null,
      };

      return userState;
    },
    [`personState-${environmentId}-${userId}`],
    {
      ...(IS_FORMBRICKS_CLOUD && { revalidate: 24 * 60 * 60 }),
      tags: [
        environmentCache.tag.byId(environmentId),
        organizationCache.tag.byEnvironmentId(environmentId),
        personCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        attributeCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        displayCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        responseCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        segmentCache.tag.byEnvironmentId(environmentId),
      ],
    }
  )();
