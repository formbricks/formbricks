"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getEnvironment } from "@formbricks/lib/environment/service";
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
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZLanguageInput } from "@formbricks/types/product";

const ZCreateLanguageAction = z.object({
  environmentId: ZId,
  languageInput: ZLanguageInput,
});

export const createLanguageAction = authenticatedActionClient
  .schema(ZCreateLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    const environment = await getEnvironment(parsedInput.environmentId);
    if (!environment) {
      throw new ResourceNotFoundError("Environment", parsedInput.environmentId);
    }
    await checkAuthorization({
      data: parsedInput.languageInput,
      schema: ZLanguageInput,
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(environment.productId),
      rules: ["language", "create"],
    });

    return await createLanguage(environment.productId, parsedInput.environmentId, parsedInput.languageInput);
  });

const ZDeleteLanguageAction = z.object({
  environmentId: ZId,
  languageId: ZId,
});

export const deleteLanguageAction = authenticatedActionClient
  .schema(ZDeleteLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromLanguageId(parsedInput.languageId),
      rules: ["language", "delete"],
    });

    return await deleteLanguage(parsedInput.environmentId, parsedInput.languageId);
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
  environmentId: ZId,
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

    return await updateLanguage(parsedInput.environmentId, parsedInput.languageId, parsedInput.languageInput);
  });
