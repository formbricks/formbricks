"use server";

import { actionClient } from "@/lib/utils/action-client";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import { SAML_PRODUCT, SAML_TENANT } from "@formbricks/lib/constants";

export const doesSamlConnectionExistAction = actionClient.action(async () => {
  const jacksonInstance = await jackson();

  if (!jacksonInstance) {
    return false;
  }

  const { connectionController } = jacksonInstance;
  const connection = await connectionController.getConnections({
    product: SAML_PRODUCT,
    tenant: SAML_TENANT,
  });

  return connection.length === 1;
});
