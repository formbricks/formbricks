import { SAMLSSOConnectionWithEncodedMetadata } from "@boxyhq/saml-jackson";
import { ConnectionAPIController } from "@boxyhq/saml-jackson/dist/controller/api";
import { SAML_PRODUCT, SAML_RAW_METADATA, SAML_TENANT, WEBAPP_URL } from "@formbricks/lib/constants";

const createConnectionPayload = (): SAMLSSOConnectionWithEncodedMetadata => {
  const encodedRawMetadata = Buffer.from(SAML_RAW_METADATA || "", "utf8").toString("base64");

  return {
    name: "SAML SSO",
    defaultRedirectUrl: `${WEBAPP_URL}/auth/login`,
    redirectUrl: [`${WEBAPP_URL}/*`],
    tenant: SAML_TENANT,
    product: SAML_PRODUCT,
    encodedRawMetadata,
  };
};

export const preloadConnection = async (connectionController: ConnectionAPIController) => {
  if (SAML_RAW_METADATA) {
    const connection = createConnectionPayload();
    await connectionController.createSAMLConnection(connection);
  } else {
    console.log("SAML_RAW_METADATA is not set");
  }
};
