"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromPersonId,
  getProductIdFromEnvironmentId,
  getProductIdFromPersonId,
} from "@/lib/utils/helper";
import { z } from "zod";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { deletePerson, getPeople } from "@formbricks/lib/person/service";
import { ZId } from "@formbricks/types/common";

const ZGetPersonsAction = z.object({
  environmentId: ZId,
  offset: z.number().int().nonnegative(),
  searchValue: z.string().optional(),
});

export const getPersonsAction = authenticatedActionClient
  .schema(ZGetPersonsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          rules: ["person", "read"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return getPeople(parsedInput.environmentId, parsedInput.offset, parsedInput.searchValue);
  });

const ZGetPersonAttributesAction = z.object({
  environmentId: ZId,
  personId: ZId,
});

export const getPersonAttributesAction = authenticatedActionClient
  .schema(ZGetPersonAttributesAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          rules: ["person", "read"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return getAttributes(parsedInput.personId);
  });

const ZPersonDeleteAction = z.object({
  personId: ZId,
});

export const deletePersonAction = authenticatedActionClient
  .schema(ZPersonDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromPersonId(parsedInput.personId),
      access: [
        {
          type: "organization",
          rules: ["person", "delete"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromPersonId(parsedInput.personId),
        },
      ],
    });

    return await deletePerson(parsedInput.personId);
  });
