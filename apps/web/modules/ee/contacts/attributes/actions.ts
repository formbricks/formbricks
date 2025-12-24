"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironment } from "@/lib/environment/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { deleteContactAttributeKey } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/[contactAttributeKeyId]/lib/contact-attribute-key";
import { createContactAttributeKey } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/lib/contact-attribute-keys";

const ZCreateAttributeKeyAction = z.object({
  environmentId: ZId,
  key: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  dataType: ZContactAttributeDataType,
});

export const createAttributeKeyAction = authenticatedActionClient
  .schema(ZCreateAttributeKeyAction)
  .action(async ({ ctx, parsedInput }) => {
    const environment = await getEnvironment(parsedInput.environmentId);
    if (!environment) {
      throw new ResourceNotFoundError("Environment", parsedInput.environmentId);
    }

    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

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
          projectId: environment.projectId,
        },
      ],
    });

    const attributeKey = await createContactAttributeKey(parsedInput.environmentId, {
      key: parsedInput.key,
      name: parsedInput.name,
      description: parsedInput.description,
      type: "custom",
      dataType: parsedInput.dataType,
      environmentId: parsedInput.environmentId,
    });

    revalidatePath(`/environments/${parsedInput.environmentId}/attributes`);

    return attributeKey;
  });

const ZDeleteAttributeKeyAction = z.object({
  environmentId: ZId,
  attributeKeyId: ZId,
});

export const deleteAttributeKeyAction = authenticatedActionClient
  .schema(ZDeleteAttributeKeyAction)
  .action(async ({ ctx, parsedInput }) => {
    const environment = await getEnvironment(parsedInput.environmentId);
    if (!environment) {
      throw new ResourceNotFoundError("Environment", parsedInput.environmentId);
    }

    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

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
          projectId: environment.projectId,
        },
      ],
    });

    const result = await deleteContactAttributeKey(parsedInput.attributeKeyId);

    revalidatePath(`/environments/${parsedInput.environmentId}/attributes`);

    return result;
  });
