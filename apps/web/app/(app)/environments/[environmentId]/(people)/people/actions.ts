"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getProductIdFromEnvironmentId } from "@/lib/utils/helper";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { getPeople } from "@formbricks/lib/person/service";
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
          type: "product",
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
          type: "product",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return getAttributes(parsedInput.personId);
  });
