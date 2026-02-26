"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZCreateSurveyResultShareLink } from "@formbricks/types/survey-result-share-link";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import {
  createSurveyResultShareLink,
  getSurveyResultShareLinks,
  revokeSurveyResultShareLink,
} from "./lib/survey-result-share-link";

const ZCreateSurveyResultShareLinkAction = ZCreateSurveyResultShareLink;

export const createSurveyResultShareLinkAction = authenticatedActionClient
  .schema(ZCreateSurveyResultShareLinkAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return createSurveyResultShareLink(
      parsedInput.surveyId,
      ctx.user.id,
      parsedInput.expiresIn,
      parsedInput.label
    );
  });

const ZGetSurveyResultShareLinksAction = z.object({
  surveyId: ZId,
});

export const getSurveyResultShareLinksAction = authenticatedActionClient
  .schema(ZGetSurveyResultShareLinksAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return getSurveyResultShareLinks(parsedInput.surveyId);
  });

const ZRevokeSurveyResultShareLinkAction = z.object({
  surveyId: ZId,
  linkId: z.string().cuid(),
});

export const revokeSurveyResultShareLinkAction = authenticatedActionClient
  .schema(ZRevokeSurveyResultShareLinkAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return revokeSurveyResultShareLink(parsedInput.linkId);
  });
