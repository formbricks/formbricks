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
  console.log("preloadConnection", SAML_RAW_METADATA);
  if (SAML_RAW_METADATA) {
    console.log("SAML_RAW_METADATA is set");
    const connection = createConnectionPayload();
    console.log("connection", connection);
    await connectionController.createSAMLConnection(connection);
    console.log("connection created");
  } else {
    console.log("SAML_RAW_METADATA is not set");
  }
};
