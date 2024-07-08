"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromPersonId } from "@formbricks/lib/organization/utils";
import { deletePerson } from "@formbricks/lib/person/service";

const ZPersonDeleteAction = z.object({
  personId: z.string(),
});

export const deletePersonAction = authenticatedActionClient
  .schema(ZPersonDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    // get organizationId from personId
    const organizationId = await getOrganizationIdFromPersonId(parsedInput.personId);
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: organizationId,
      rules: ["person", "delete"],
    });
    return await deletePerson(parsedInput.personId);
  });
