"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromPersonId } from "@formbricks/lib/organization/utils";
import { deletePerson } from "@formbricks/lib/person/service";

const ZPersonDeleteAction = z.object({
  personId: z.string(),
});

export const deletePersonAction = async (props: z.infer<typeof ZPersonDeleteAction>) =>
  authenticatedActionClient
    .schema(ZPersonDeleteAction)
    .metadata({ rules: ["person", "delete"] })
    // get organizationId from personId
    .use(async ({ ctx, next }) => {
      const organizationId = await getOrganizationIdFromPersonId(props.personId);
      return next({ ctx: { ...ctx, organizationId } });
    })
    .use(async ({ ctx, next, metadata }) => {
      await checkAuthorization({
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        rules: metadata.rules,
      });
      return next({ ctx });
    })
    .action(async () => await deletePerson(props.personId))(props);
