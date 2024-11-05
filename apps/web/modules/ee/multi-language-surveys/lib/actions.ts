"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProductId,
  getProductIdFromLanguageId,
} from "@/lib/utils/helper";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import {
  createLanguage,
  deleteLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@formbricks/lib/language/service";
import { ZId } from "@formbricks/types/common";
import { ZLanguageInput } from "@formbricks/types/product";

const ZCreateLanguageAction = z.object({
  productId: ZId,
  languageInput: ZLanguageInput,
});

export const createLanguageAction = authenticatedActionClient
  .schema(ZCreateLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      access: [
        {
          type: "organization",
          schema: ZLanguageInput,
          data: parsedInput.languageInput,
          rules: ["language", "create"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "readWrite",
        },
      ],
    });

    return await createLanguage(parsedInput.productId, parsedInput.languageInput);
  });

const ZDeleteLanguageAction = z.object({
  languageId: ZId,
  productId: ZId,
});

export const deleteLanguageAction = authenticatedActionClient
  .schema(ZDeleteLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromLanguageId(parsedInput.languageId),
      access: [
        {
          type: "organization",
          rules: ["language", "delete"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "readWrite",
        },
      ],
    });

    return await deleteLanguage(parsedInput.languageId, parsedInput.productId);
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
          rules: ["survey", "read"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromLanguageId(parsedInput.languageId),
          minPermission: "read",
        },
      ],
    });

    return await getSurveysUsingGivenLanguage(parsedInput.languageId);
  });

const ZUpdateLanguageAction = z.object({
  productId: ZId,
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
          rules: ["language", "update"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "readWrite",
        },
      ],
    });

    return await updateLanguage(parsedInput.productId, parsedInput.languageId, parsedInput.languageInput);
  });
