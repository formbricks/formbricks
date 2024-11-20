"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProductId,
  getProductIdFromLanguageId,
} from "@/lib/utils/helper";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import {
  createLanguage,
  deleteLanguage,
  getSurveysUsingGivenLanguage,
  updateLanguage,
} from "@formbricks/lib/language/service";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZLanguageInput } from "@formbricks/types/product";

const ZCreateLanguageAction = z.object({
  productId: ZId,
  languageInput: ZLanguageInput,
});

const checkMultiLanguagePermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isAdvancedTargetingAllowed = await getMultiLanguagePermission(organization);

  if (!isAdvancedTargetingAllowed) {
    throw new OperationNotAllowedError("Multi language is not allowed for this organization");
  }
};

export const createLanguageAction = authenticatedActionClient
  .schema(ZCreateLanguageAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromProductId(parsedInput.productId);

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
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "manage",
        },
      ],
    });
    await checkMultiLanguagePermission(organizationId);

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

    const organizationId = await getOrganizationIdFromProductId(parsedInput.productId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
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
    await checkMultiLanguagePermission(organizationId);

    return await deleteLanguage(parsedInput.languageId, parsedInput.productId);
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
          type: "productTeam",
          productId: await getProductIdFromLanguageId(parsedInput.languageId),
          minPermission: "manage",
        },
      ],
    });
    await checkMultiLanguagePermission(organizationId);

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
    const languageProductId = await getProductIdFromLanguageId(parsedInput.languageId);

    if (languageProductId !== parsedInput.productId) {
      throw new Error("Invalid language id");
    }

    const organizationId = await getOrganizationIdFromProductId(parsedInput.productId);

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
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "manage",
        },
      ],
    });
    await checkMultiLanguagePermission(organizationId);

    return await updateLanguage(parsedInput.productId, parsedInput.languageId, parsedInput.languageInput);
  });
