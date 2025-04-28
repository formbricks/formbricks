"use server";

import {
  createLanguage,
  deleteLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@/lib/language/service";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProjectId,
  getProjectIdFromLanguageId,
} from "@/lib/utils/helper";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZLanguageInput } from "@formbricks/types/project";

const ZCreateLanguageAction = z.object({
  projectId: ZId,
  languageInput: ZLanguageInput,
});

export const checkMultiLanguagePermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization.billing.plan);

  if (!isMultiLanguageAllowed) {
    throw new OperationNotAllowedError("Multi language is not allowed for this organization");
  }
};

export const createLanguageAction = authenticatedActionClient
  .schema(ZCreateLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          schema: ZLanguageInput,
          data: parsedInput.languageInput,
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: parsedInput.projectId,
          minPermission: "manage",
        },
      ],
    });
    await checkMultiLanguagePermission(organizationId);

    return await createLanguage(parsedInput.projectId, parsedInput.languageInput);
  });

const ZDeleteLanguageAction = z.object({
  languageId: ZId,
  projectId: ZId,
});

export const deleteLanguageAction = authenticatedActionClient
  .schema(ZDeleteLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    const languageProjectId = await getProjectIdFromLanguageId(parsedInput.languageId);

    if (languageProjectId !== parsedInput.projectId) {
      throw new Error("Invalid language id");
    }

    const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: parsedInput.projectId,
          minPermission: "manage",
        },
      ],
    });
    await checkMultiLanguagePermission(organizationId);

    return await deleteLanguage(parsedInput.languageId, parsedInput.projectId);
  });

const ZGetSurveysUsingGivenLanguageAction = z.object({
  languageId: ZId,
});

export const getSurveysUsingGivenLanguageAction = authenticatedActionClient
  .schema(ZGetSurveysUsingGivenLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromLanguageId(parsedInput.languageId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromLanguageId(parsedInput.languageId),
          minPermission: "manage",
        },
      ],
    });
    await checkMultiLanguagePermission(organizationId);

    return await getSurveysUsingGivenLanguage(parsedInput.languageId);
  });

const ZUpdateLanguageAction = z.object({
  projectId: ZId,
  languageId: ZId,
  languageInput: ZLanguageInput,
});

export const updateLanguageAction = authenticatedActionClient
  .schema(ZUpdateLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    const languageProductId = await getProjectIdFromLanguageId(parsedInput.languageId);

    if (languageProductId !== parsedInput.projectId) {
      throw new Error("Invalid language id");
    }

    const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          schema: ZLanguageInput,
          data: parsedInput.languageInput,
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: parsedInput.projectId,
          minPermission: "manage",
        },
      ],
    });
    await checkMultiLanguagePermission(organizationId);

    return await updateLanguage(parsedInput.projectId, parsedInput.languageId, parsedInput.languageInput);
  });
