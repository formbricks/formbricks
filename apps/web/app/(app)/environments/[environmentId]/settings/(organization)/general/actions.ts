"use server";

import { deleteOrganization, updateOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";

const ZUpdateOrganizationNameAction = z.object({
  organizationId: ZId,
  data: ZOrganizationUpdateInput.pick({ name: true }),
});

export const updateOrganizationNameAction = authenticatedActionClient
  .schema(ZUpdateOrganizationNameAction)
  .action(async ({ parsedInput, ctx }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          schema: ZOrganizationUpdateInput.pick({ name: true }),
          data: parsedInput.data,
          roles: ["owner"],
        },
      ],
    });

    return await updateOrganization(parsedInput.organizationId, parsedInput.data);
  });

const ZDeleteOrganizationAction = z.object({
  organizationId: ZId,
});

export const deleteOrganizationAction = authenticatedActionClient
  .schema(ZDeleteOrganizationAction)
  .action(async ({ parsedInput, ctx }) => {
    const isMultiOrgEnabled = await getIsMultiOrgEnabled();
    if (!isMultiOrgEnabled) throw new OperationNotAllowedError("Organization deletion disabled");

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner"],
        },
      ],
    });

    return await deleteOrganization(parsedInput.organizationId);
  });
