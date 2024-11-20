"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProjectId,
  getProductIdFromLanguageId,
} from "@/lib/utils/helper";
import { z } from "zod";
import {
  createLanguage,
  deleteLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@formbricks/lib/language/service";
import { ZId } from "@formbricks/types/common";
import { ZLanguageInput } from "@formbricks/types/project";

const ZCreateLanguageAction = z.object({
  projectId: ZId,
  languageInput: ZLanguageInput,
});

export const createLanguageAction = authenticatedActionClient
  .schema(ZCreateLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProjectId(parsedInput.projectId),
      access: [
        {
          type: "organization",
          schema: ZLanguageInput,
          data: parsedInput.languageInput,
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: parsedInput.projectId,
          minPermission: "manage",
        },
      ],
    });

    return await createLanguage(parsedInput.projectId, parsedInput.languageInput);
  });

const ZDeleteLanguageAction = z.object({
  languageId: ZId,
  projectId: ZId,
});

export const deleteLanguageAction = authenticatedActionClient
  .schema(ZDeleteLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    const languageProductId = await getProductIdFromLanguageId(parsedInput.languageId);

    if (languageProductId !== parsedInput.projectId) {
      throw new Error("Invalid language id");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProjectId(parsedInput.projectId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: parsedInput.projectId,
          minPermission: "manage",
        },
      ],
    });

    return await deleteLanguage(parsedInput.languageId, parsedInput.projectId);
  });

const ZGetSurveysUsingGivenLanguageAction = z.object({
  languageId: ZId,
});

export const getSurveysUsingGivenLanguageAction = authenticatedActionClient
  .schema(ZGetSurveysUsingGivenLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromLanguageId(parsedInput.languageId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromLanguageId(parsedInput.languageId),
          minPermission: "manage",
        },
      ],
    });

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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromLanguageId(parsedInput.languageId),
      access: [
        {
          type: "organization",
          schema: ZLanguageInput,
          data: parsedInput.languageInput,
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: parsedInput.projectId,
          minPermission: "manage",
        },
      ],
    });

    return await updateLanguage(parsedInput.projectId, parsedInput.languageId, parsedInput.languageInput);
  });
