"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProductId,
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
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "manage",
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
    const languageProductId = await getProductIdFromLanguageId(parsedInput.languageId);

    if (languageProductId !== parsedInput.productId) {
      throw new Error("Invalid language id");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "manage",
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
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "manage",
        },
      ],
    });

    return await updateLanguage(parsedInput.productId, parsedInput.languageId, parsedInput.languageInput);
  });
