"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromContactId,
  getOrganizationIdFromEnvironmentId,
  getProjectIdFromContactId,
  getProjectIdFromEnvironmentId,
} from "@/lib/utils/helper";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { createContactsFromCSV, deleteContact, getContacts } from "./lib/contacts";
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
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return getContacts(parsedInput.environmentId, parsedInput.offset, parsedInput.searchValue);
  });

const ZContactDeleteAction = z.object({
  contactId: ZId,
});

export const deleteContactAction = authenticatedActionClient
  .schema(ZContactDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromContactId(parsedInput.contactId);
    const projectId = await getProjectIdFromContactId(parsedInput.contactId);

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
          minPermission: "readWrite",
          projectId,
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
          type: "projectTeam",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
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
