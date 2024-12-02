"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProductIdFromEnvironmentId } from "@/lib/utils/helper";
import { z } from "zod";
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member"],
        },
      ],
    });

    return getContacts(parsedInput.environmentId, parsedInput.offset, parsedInput.searchValue);
  });

export const getContactAttributeKeysAction = authenticatedActionClient
  .schema(z.object({ environmentId: ZId }))
  .action(async ({ ctx, parsedInput: { environmentId } }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member"],
        },
      ],
    });

    return getContactAttributeKeys(environmentId);
  });

const ZPersonDeleteAction = z.object({
  contactId: ZId,
});

export const deleteContactAction = authenticatedActionClient
  .schema(ZPersonDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromContactId(parsedInput.contactId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
          minPermission: "readWrite",
        },
      ],
    });

    const result = await createContactsFromCSV(
      parsedInput.csvData,
      parsedInput.environmentId,
      parsedInput.duplicateContactsAction,
      parsedInput.attributeMap
    );

    return result;
  });
