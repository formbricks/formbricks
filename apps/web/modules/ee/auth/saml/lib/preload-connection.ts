import { SAMLSSOConnectionWithEncodedMetadata } from "@boxyhq/saml-jackson";
import { ConnectionAPIController } from "@boxyhq/saml-jackson/dist/controller/api";
import fs from "fs/promises";
import path from "path";
import { SAML_PRODUCT, SAML_TENANT, SAML_XML_DIR, WEBAPP_URL } from "@formbricks/lib/constants";

const readPreloadedConnectionsDir = async () => {
  const preloadedConnections = await fs.readdir(path.join(SAML_XML_DIR));
  const xmlFiles = preloadedConnections.filter((file) => file.endsWith(".xml"));
  return xmlFiles[0] || null;
};

const getPreloadedConnectionMetadata = async () => {
  const preloadedConnections = await readPreloadedConnectionsDir();
  if (!preloadedConnections) return null;

  const preloadedConnectionMetadata = await fs.readFile(
    path.join(SAML_XML_DIR, preloadedConnections),
    "utf8"
  );
  return preloadedConnectionMetadata;
};

const getEncodedRawMetadata = (metadata: string) => {
  return Buffer.from(metadata, "utf8").toString("base64");
};

const getConnectionPayload = async (metadata: string): Promise<SAMLSSOConnectionWithEncodedMetadata> => {
  const encodedRawMetadata = getEncodedRawMetadata(metadata);

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

  const connection = await getConnectionPayload(preloadedConnectionMetadata);
  const newConnection = await connectionController.createSAMLConnection(connection);

  if (newConnection && existingConnection && newConnection.clientID !== existingConnection.clientID) {
    await connectionController.deleteConnections({
      clientID: existingConnection.clientID,
      clientSecret: existingConnection.clientSecret,
      product: existingConnection.product,
      tenant: existingConnection.tenant,
    });
  }
};
