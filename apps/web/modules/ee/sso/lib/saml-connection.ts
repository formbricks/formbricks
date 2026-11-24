import "server-only";
import { logger } from "@formbricks/logger";
import { SAML_PRODUCT, SAML_TENANT } from "@/lib/constants";
import jackson from "@/modules/ee/auth/saml/lib/jackson";
import type { TSsoAvailability } from "./sso-availability";

/**
 * Whether this instance has exactly one SAML connection, the one the SAML button signs in with. Asked
 * where the login and sign-up pages render, and only when the button is offered, so a page without SAML
 * never starts Jackson. The button refuses to start sign-in without it.
 *
 * A failed lookup answers false, as the click-time action it replaces did: the button then shows its
 * connection error instead of the page failing to render.
 */
export const getSamlConnectionExists = async ({ providers }: TSsoAvailability): Promise<boolean> => {
  if (!providers.saml) return false;

  try {
    const jacksonInstance = await jackson();
    if (!jacksonInstance) return false;

    const connections = await jacksonInstance.connectionController.getConnections({
      product: SAML_PRODUCT,
      tenant: SAML_TENANT,
    });
    return connections.length === 1;
  } catch (error) {
    logger.error({ err: error }, "SAML connection lookup failed");
    return false;
  }
};
