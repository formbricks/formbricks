"use server";

import { actionClient, authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromActionClassId, getProjectIdFromActionClassId } from "@/lib/utils/helper";
import { z } from "zod";
import { deleteActionClass, getActionClass, updateActionClass } from "@formbricks/lib/actionClass/service";
import { cache } from "@formbricks/lib/cache";
import { getSurveysByActionClassId } from "@formbricks/lib/survey/service";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";

const ZDeleteActionClassAction = z.object({
  actionClassId: ZId,
});

export const deleteActionClassAction = authenticatedActionClient
  .schema(ZDeleteActionClassAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromActionClassId(parsedInput.actionClassId),
        },
      ],
    });

    await deleteActionClass(parsedInput.actionClassId);
  });

const ZUpdateActionClassAction = z.object({
  actionClassId: ZId,
  updatedAction: ZActionClassInput,
});

export const updateActionClassAction = authenticatedActionClient
  .schema(ZUpdateActionClassAction)
  .action(async ({ ctx, parsedInput }) => {
    const actionClass = await getActionClass(parsedInput.actionClassId);
    if (actionClass === null) {
      throw new ResourceNotFoundError("ActionClass", parsedInput.actionClassId);
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromActionClassId(parsedInput.actionClassId),
        },
      ],
    });

    return await updateActionClass(
      actionClass.environmentId,
      parsedInput.actionClassId,
      parsedInput.updatedAction
    );
  });

const ZGetActiveInactiveSurveysAction = z.object({
  actionClassId: ZId,
});

export const getActiveInactiveSurveysAction = authenticatedActionClient
  .schema(ZGetActiveInactiveSurveysAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromActionClassId(parsedInput.actionClassId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromActionClassId(parsedInput.actionClassId),
        },
      ],
    });

    const surveys = await getSurveysByActionClassId(parsedInput.actionClassId);
    const response = {
      activeSurveys: surveys.filter((s) => s.status === "inProgress").map((survey) => survey.name),
      inactiveSurveys: surveys.filter((s) => s.status !== "inProgress").map((survey) => survey.name),
    };
    return response;
  });

const getLatestStableFbRelease = async (): Promise<string | null> =>
  cache(
    async () => {
      try {
        const res = await fetch("https://api.github.com/repos/formbricks/formbricks/releases");
        const releases = await res.json();

        if (Array.isArray(releases)) {
          const latestStableReleaseTag = releases.filter((release) => !release.prerelease)?.[0]
            ?.tag_name as string;
          if (latestStableReleaseTag) {
            return latestStableReleaseTag;
          }
        }

        return null;
      } catch (err) {
        return null;
      }
    },
    ["latest-fb-release"],
    {
      revalidate: 60 * 60 * 24, // 24 hours
    }
  )();

export const getLatestStableFbReleaseAction = actionClient.action(async () => {
  return await getLatestStableFbRelease();
});
