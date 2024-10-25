"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";
import {
  createContactsFromCSV,
  deleteContact,
  getContactAttributeKeys,
  getContacts,
  getOrganizationIdFromContactId,
} from "./lib/contacts";
import {
  ZContactCSVAttributeMap,
  ZContactCSVDuplicateAction,
  ZContactCSVUploadResponse,
} from "./types/contact";

const ZGetContactsAction = z.object({
  environmentId: ZId,
  offset: z.number().int().nonnegative(),
  searchValue: z.string().optional(),
});

export const getContactsAction = authenticatedActionClient
  .schema(ZGetContactsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

    return getContacts(parsedInput.environmentId, parsedInput.offset, parsedInput.searchValue);
  });

export const getContactAttributeKeysAction = authenticatedActionClient
  .schema(z.object({ environmentId: ZId }))
  .action(async ({ ctx, parsedInput: { environmentId } }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(environmentId),
      rules: ["environment", "read"],
    });

    return getContactAttributeKeys(environmentId);
  });

const ZPersonDeleteAction = z.object({
  contactId: ZId,
});

export const deleteContactAction = authenticatedActionClient
  .schema(ZPersonDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromContactId(parsedInput.contactId),
      rules: ["person", "delete"],
    });

    return await deleteContact(parsedInput.contactId);
  });

const ZCreateContactsFromCSV = z.object({
  csvData: ZContactCSVUploadResponse,
  environmentId: ZId,
  duplicateContactsAction: ZContactCSVDuplicateAction,
  attributeMap: ZContactCSVAttributeMap,
});

export const createContactsFromCSVAction = authenticatedActionClient
  .schema(ZCreateContactsFromCSV)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["person", "create"],
    });

    const result = await createContactsFromCSV(
      parsedInput.csvData,
      parsedInput.environmentId,
      parsedInput.duplicateContactsAction,
      parsedInput.attributeMap
    );

    return result;
  });
