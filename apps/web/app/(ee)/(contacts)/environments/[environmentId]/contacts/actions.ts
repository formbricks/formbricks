"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";
import { getContactAttributeKeys, getContacts } from "./lib/contacts";

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

// const ZGetPersonAttributesAction = z.object({
//   environmentId: ZId,
//   personId: ZId,
// });

// export const getPersonAttributesAction = authenticatedActionClient
//   .schema(ZGetPersonAttributesAction)
//   .action(async ({ ctx, parsedInput }) => {
//     await checkAuthorization({
//       userId: ctx.user.id,
//       organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
//       rules: ["environment", "read"],
//     });

//     return getAttributes(parsedInput.personId);
//   });