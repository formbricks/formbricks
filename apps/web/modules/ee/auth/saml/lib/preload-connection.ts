import { SAMLSSOConnectionWithEncodedMetadata, SAMLSSORecord } from "@boxyhq/saml-jackson";
import { ConnectionAPIController } from "@boxyhq/saml-jackson/dist/controller/api";
import fs from "fs/promises";
import path from "path";
import { SAML_PRODUCT, SAML_TENANT, SAML_XML_DIR, WEBAPP_URL } from "@formbricks/lib/constants";

const getPreloadedConnectionFile = async () => {
  const preloadedConnections = await fs.readdir(path.join(SAML_XML_DIR));
  const xmlFiles = preloadedConnections.filter((file) => file.endsWith(".xml"));
  if (xmlFiles.length === 0) {
    throw new Error("No preloaded connection file found");
  }
  return xmlFiles[0];
};

const getPreloadedConnectionMetadata = async () => {
  const preloadedConnectionFile = await getPreloadedConnectionFile();

  const preloadedConnectionMetadata = await fs.readFile(
    path.join(SAML_XML_DIR, preloadedConnectionFile),
    "utf8"
  );
  return preloadedConnectionMetadata;
};

const getConnectionPayload = (metadata: string): SAMLSSOConnectionWithEncodedMetadata => {
  const encodedRawMetadata = Buffer.from(metadata, "utf8").toString("base64");

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
  try {
    const preloadedConnectionMetadata = await getPreloadedConnectionMetadata();

    if (!preloadedConnectionMetadata) {
      console.log("No preloaded connection metadata found");
      return;
    }

    const connections = await connectionController.getConnections({
      tenant: SAML_TENANT,
      product: SAML_PRODUCT,
    });

    const existingConnection = connections[0];

    const connection = getConnectionPayload(preloadedConnectionMetadata);
    let newConnection: SAMLSSORecord;
    try {
      newConnection = await connectionController.createSAMLConnection(connection);
    } catch (error) {
      throw new Error(`Metadata is not valid\n${error.message}`);
    }
    if (newConnection && existingConnection && newConnection.clientID !== existingConnection.clientID) {
      await connectionController.deleteConnections({
        clientID: existingConnection.clientID,
        clientSecret: existingConnection.clientSecret,
        product: existingConnection.product,
        tenant: existingConnection.tenant,
      });
    }
  } catch (error) {
    console.error("Error preloading connection:", error.message);
  }
};
