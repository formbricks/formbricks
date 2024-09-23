"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { getPeople, getPersonCount } from "@formbricks/lib/person/service";
import { ZId } from "@formbricks/types/common";

const ZGetPersonsAction = z.object({
  environmentId: ZId,
  offset: z.number(),
  searchValue: z.string().optional(),
});

export const getPersonsAction = authenticatedActionClient
  .schema(ZGetPersonsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

    return getPeople(parsedInput.environmentId, parsedInput.offset, parsedInput.searchValue);
  });

const ZGetPersonCountAction = z.object({
  environmentId: ZId,
  searchValue: z.string().optional(),
});

export const getPersonCountAction = authenticatedActionClient
  .schema(ZGetPersonCountAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

    return getPersonCount(parsedInput.environmentId, parsedInput.searchValue);
  });

const ZGetPersonAttributesAction = z.object({
  environmentId: ZId,
  personId: ZId,
});

export const getPersonAttributesAction = authenticatedActionClient
  .schema(ZGetPersonAttributesAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

    return getAttributes(parsedInput.personId);
  });
