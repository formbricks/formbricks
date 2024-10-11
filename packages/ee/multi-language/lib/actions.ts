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
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProductId,
} from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";
import { ZLanguageInput } from "@formbricks/types/product";

const ZCreateLanguageAction = z.object({
  productId: ZId,
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

    return await createLanguage(parsedInput.productId, parsedInput.languageInput);
  });

const ZDeleteLanguageAction = z.object({
  languageId: ZId,
  productId: ZId,
});

export const deleteLanguageAction = authenticatedActionClient
  .schema(ZDeleteLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromLanguageId(parsedInput.languageId),
      rules: ["language", "delete"],
    });

    return await deleteLanguage(parsedInput.languageId, parsedInput.productId);
  });

const ZGetSurveysUsingGivenLanguageAction = z.object({
  languageId: ZId,
});

export const getSurveysUsingGivenLanguageAction = authenticatedActionClient
  .schema(ZGetSurveysUsingGivenLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromLanguageId(parsedInput.languageId),
      rules: ["survey", "read"],
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
    await checkAuthorization({
      data: parsedInput.languageInput,
      schema: ZLanguageInput,
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromLanguageId(parsedInput.languageId),
      rules: ["language", "update"],
    });

    return await updateLanguage(parsedInput.productId, parsedInput.languageId, parsedInput.languageInput);
  });
