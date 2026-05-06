import "server-only";
import saml20 from "@boxyhq/saml20";
import type { IConnectionAPIController, SAMLSSORecord } from "@boxyhq/saml-jackson";
import { getDefaultCertificate } from "@boxyhq/saml-jackson/dist/saml/x509";
import { createHash } from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";

const SAML_AUTHN_INSTANT_TTL_MS = 5 * 60 * 1000;

type TSamlAuthnInstantCacheValue = {
  authnInstant: string;
};
type TSamlConnection = Awaited<ReturnType<IConnectionAPIController["getConnections"]>>[number];

const authnInstantRegex = /<[\w:-]*AuthnStatement\b[^>]*\bAuthnInstant\s*=\s*["']([^"']+)["']/;
const encryptedAssertionRegex = /<[\w:-]*EncryptedAssertion\b/;

const getSamlCodeHash = (code: string) => createHash("sha256").update(code).digest("hex");

const getSamlAuthnInstantCacheKey = (code: string) =>
  createCacheKey.custom("account_deletion", "saml_authn_instant", getSamlCodeHash(code));

const isSamlConnection = (connection: TSamlConnection): connection is SAMLSSORecord =>
  "idpMetadata" in connection;

const getCodeFromRedirectUrl = (redirectUrl: string) => {
  try {
    return new URL(redirectUrl).searchParams.get("code");
  } catch {
    return null;
  }
};

export const getSamlAuthnInstantFromXml = (samlXml: string): string | null => {
  // Use .exec() instead of .match()
  const match = authnInstantRegex.exec(samlXml);
  const authnInstant = match?.[1];

  if (!authnInstant) {
    return null;
  }

  const authnInstantTimestamp = Date.parse(authnInstant);

  if (Number.isNaN(authnInstantTimestamp)) {
    return null;
  }

  return new Date(authnInstantTimestamp).toISOString();
};

const getSignedSamlXml = async ({
  connectionController,
  decodedSamlResponse,
}: {
  connectionController: IConnectionAPIController;
  decodedSamlResponse: string;
}) => {
  const issuer = saml20.parseIssuer(decodedSamlResponse);

  if (!issuer) {
    return null;
  }

  const connections = await connectionController.getConnections({ entityId: issuer });

  for (const connection of connections) {
    if (!isSamlConnection(connection)) {
      continue;
    }

    const { publicKey, thumbprint } = connection.idpMetadata;

    if (!publicKey && !thumbprint) {
      continue;
    }

    try {
      const signedXml = saml20.validateSignature(decodedSamlResponse, publicKey ?? null, thumbprint ?? null);

      if (signedXml) {
        return signedXml;
      }
    } catch {
      continue;
    }
  }

  return null;
};

const getReadableSignedSamlXml = async (signedSamlXml: string) => {
  if (!encryptedAssertionRegex.test(signedSamlXml)) {
    return signedSamlXml;
  }

  const { privateKey } = await getDefaultCertificate();
  return saml20.decryptXml(signedSamlXml, { privateKey }).assertion;
};

export const getSamlAuthnInstantFromResponse = async ({
  connectionController,
  samlResponse,
}: {
  connectionController: IConnectionAPIController;
  samlResponse: string;
}): Promise<string | null> => {
  const decodedSamlResponse = Buffer.from(samlResponse, "base64").toString("utf8");
  const signedSamlXml = await getSignedSamlXml({
    connectionController,
    decodedSamlResponse,
  });

  if (!signedSamlXml) {
    return null;
  }

  return getSamlAuthnInstantFromXml(await getReadableSignedSamlXml(signedSamlXml));
};

export const storeSamlAuthnInstantFromSamlResponse = async ({
  connectionController,
  redirectUrl,
  samlResponse,
}: {
  connectionController: IConnectionAPIController;
  redirectUrl: string;
  samlResponse: string;
}) => {
  const code = getCodeFromRedirectUrl(redirectUrl);

  if (!code) {
    return;
  }

  const authnInstant = await getSamlAuthnInstantFromResponse({
    connectionController,
    samlResponse,
  }).catch((error: unknown) => {
    logger.error({ error }, "Failed to extract SAML AuthnInstant");
    return null;
  });

  if (!authnInstant) {
    return;
  }

  const result = await cache.set(
    getSamlAuthnInstantCacheKey(code),
    { authnInstant },
    SAML_AUTHN_INSTANT_TTL_MS
  );

  if (!result.ok) {
    logger.error({ error: result.error }, "Failed to store SAML AuthnInstant");
  }
};

export const consumeSamlAuthnInstantForCode = async (code: unknown): Promise<string | null> => {
  if (typeof code !== "string" || !code) {
    return null;
  }

  const cacheKey = getSamlAuthnInstantCacheKey(code);
  const result = await cache.get<TSamlAuthnInstantCacheValue>(cacheKey);

  if (!result.ok) {
    logger.error({ error: result.error }, "Failed to read SAML AuthnInstant");
    return null;
  }

  if (!result.data) {
    return null;
  }

  const deleteResult = await cache.del([cacheKey]);

  if (!deleteResult.ok) {
    logger.error({ error: deleteResult.error }, "Failed to consume SAML AuthnInstant");
  }

  return result.data.authnInstant;
};
