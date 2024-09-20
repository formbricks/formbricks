"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { getPeople } from "@formbricks/lib/person/service";
import { ZId } from "@formbricks/types/common";

const ZGetPersonsAction = z.object({
  environmentId: ZId,
  page: z.number(),
});

export const getPersonsAction = authenticatedActionClient
  .schema(ZGetPersonsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

    return getPeople(parsedInput.environmentId, parsedInput.page);
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
