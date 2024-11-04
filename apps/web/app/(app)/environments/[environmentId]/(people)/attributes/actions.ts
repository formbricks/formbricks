"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProductIdFromEnvironmentId } from "@/lib/utils/helper";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { getSegmentsByAttributeClassName } from "@formbricks/lib/segment/service";
import { ZAttributeClass } from "@formbricks/types/attribute-classes";
import { ZId } from "@formbricks/types/common";

const ZGetSegmentsByAttributeClassAction = z.object({
  environmentId: ZId,
  attributeClass: ZAttributeClass,
});

export const getSegmentsByAttributeClassAction = authenticatedActionClient
  .schema(ZGetSegmentsByAttributeClassAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "product",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    const segments = await getSegmentsByAttributeClassName(
      parsedInput.environmentId,
      parsedInput.attributeClass.name
    );

    // segments is an array of segments, each segment has a survey array with objects with properties: id, name and status.
    // We need the name of the surveys only and we need to filter out the surveys that are both in progress and not in progress.

    const activeSurveys = segments
      .map((segment) =>
        segment.surveys.filter((survey) => survey.status === "inProgress").map((survey) => survey.name)
      )
      .flat();
    const inactiveSurveys = segments
      .map((segment) =>
        segment.surveys.filter((survey) => survey.status !== "inProgress").map((survey) => survey.name)
      )
      .flat();

    return { activeSurveys, inactiveSurveys };
  });
