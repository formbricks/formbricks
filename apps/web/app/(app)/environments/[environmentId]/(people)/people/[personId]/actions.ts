"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromPersonId } from "@formbricks/lib/organization/utils";
import { deletePerson } from "@formbricks/lib/person/service";
import { ZId } from "@formbricks/types/common";

const ZPersonDeleteAction = z.object({
  personId: ZId,
});

export const deletePersonAction = authenticatedActionClient
  .schema(ZPersonDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromPersonId(parsedInput.personId),
      rules: ["person", "delete"],
    });

    return await deletePerson(parsedInput.personId);
  });
