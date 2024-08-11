"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import {
  createLanguage,
  deleteLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@formbricks/lib/language/service";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromProductId,
} from "@formbricks/lib/organization/utils";
import { ZLanguageInput } from "@formbricks/types/product";

const ZCreateLanguageAction = z.object({
  productId: z.string(),
  environmentId: z.string(),
  languageInput: ZLanguageInput,
});

export const createLanguageAction = authenticatedActionClient
  .schema(ZCreateLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      data: parsedInput.languageInput,
      schema: ZLanguageInput,
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      rules: ["language", "create"],
    });

    return await createLanguage(parsedInput.productId, parsedInput.environmentId, parsedInput.languageInput);
  });

const ZDeleteLanguageAction = z.object({
  environmentId: z.string(),
  languageId: z.string(),
});

export const deleteLanguageAction = authenticatedActionClient
  .schema(ZDeleteLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["language", "delete"],
    });

    return await deleteLanguage(parsedInput.environmentId, parsedInput.languageId);
  });

const ZGetSurveysUsingGivenLanguageAction = z.object({
  productId: z.string(),
  languageId: z.string(),
});

export const getSurveysUsingGivenLanguageAction = authenticatedActionClient
  .schema(ZGetSurveysUsingGivenLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      rules: ["survey", "read"],
    });

    return await getSurveysUsingGivenLanguage(parsedInput.languageId);
  });

const ZUpdateLanguageAction = z.object({
  environmentId: z.string(),
  languageId: z.string(),
  languageInput: ZLanguageInput,
});

export const updateLanguageAction = authenticatedActionClient
  .schema(ZUpdateLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      data: parsedInput.languageInput,
      schema: ZLanguageInput,
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["language", "update"],
    });

    return await updateLanguage(parsedInput.environmentId, parsedInput.languageId, parsedInput.languageInput);
  });
