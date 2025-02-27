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

const createConnectionPayload = async (metadata: string): Promise<SAMLSSOConnectionWithEncodedMetadata> => {
  const encodedRawMetadata = Buffer.from(metadata || "", "utf8").toString("base64");

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
  console.log("preloadedConnectionMetadata", preloadedConnectionMetadata);
  if (preloadedConnectionMetadata) {
    const connection = await createConnectionPayload(preloadedConnectionMetadata);
    console.log("connection", connection);
    const res = await connectionController.createSAMLConnection(connection);
    console.log("res", res);
  } else {
    console.log("No preloaded connection metadata found");
  }
};
