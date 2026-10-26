import "server-only";
import type { IConnectionAPIController, IOAuthController, JacksonOption } from "@boxyhq/saml-jackson";
import { logger } from "@formbricks/logger";
import {
  SAML_AUDIENCE,
  SAML_DATABASE_URL,
  SAML_PATH,
  SAML_PRODUCT,
  SAML_TENANT,
  WEBAPP_URL,
} from "@/lib/constants";
import { toLogText } from "@/lib/utils/strings";
import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import type { SamlIdpVerification } from "@/modules/ee/auth/saml/lib/saml-parse-worker";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";

declare global {
  var oauthController: IOAuthController | undefined;
  var connectionController: IConnectionAPIController | undefined;
  var samlDecryptionKey: (() => Promise<string>) | undefined;
  var samlIdpVerification: SamlIdpVerification | null | undefined;
  /** When the next request may read the connection's certificates again, after a failed read; unset otherwise. */
  var samlIdpVerificationRetryAt: number | undefined;
}

const g = global;

/**
 * Longest jackson log message that reaches the log. jackson writes its errors with their parser and library text
 * (`SAMLResponse error: ...`) for responses anyone can post, so it is capped and stripped like any untrusted text.
 */
const JACKSON_LOG_TEXT_LIMIT = 500;

/**
 * jackson logs every response that fails validation as `SAMLResponse error: ...` at error level. That is the
 * sender's fault, anyone can post one, and the callback route already logs it as a warning with its identifiers, so
 * it is demoted here and error stays meaningful for alerts.
 */
const SENDER_FAULT_PREFIX = "SAMLResponse error:";

/** jackson's log lines through Formbricks' logger instead of the console. The error object's message only. */
const jacksonLogger = (level: "info" | "warn" | "error") => (message: string, error?: unknown) =>
  logger[level === "error" && message.startsWith(SENDER_FAULT_PREFIX) ? "warn" : level](
    {
      source: "saml-jackson",
      error: error instanceof Error ? toLogText(error.message, JACKSON_LOG_TEXT_LIMIT) : undefined,
    },
    toLogText(message, JACKSON_LOG_TEXT_LIMIT) ?? ""
  );

/**
 * What jackson checks a response's signature with: the configured connection's IdP certificates (comma-joined when
 * its metadata lists several, as during a rollover), or else its thumbprint, as jackson picks them for `validate`.
 * The parse worker runs the same check with them, so it is timed as jackson will run it: once per certificate when
 * none matches (ENG-4108). `null` when no connection is configured, where jackson refuses before validating.
 * Formbricks configures its one connection only when jackson starts (`preloadConnection`), so it is read then.
 */
const readIdpVerification = async (
  connectionController: IConnectionAPIController
): Promise<SamlIdpVerification | null> => {
  const [connection] = await connectionController.getConnections({
    tenant: SAML_TENANT,
    product: SAML_PRODUCT,
  });
  if (!connection || !("idpMetadata" in connection)) return null;
  const { publicKey, thumbprint } = connection.idpMetadata;
  if (publicKey) return { publicKey };
  return thumbprint ? { thumbprint } : null;
};

/** How long after a failed read of the connection's certificates the next request tries again. */
const IDP_VERIFICATION_RETRY_MS = 30_000;

/**
 * Reads the connection's certificates into `g.samlIdpVerification`. Only the worker's cost estimate depends on them:
 * jackson validates with the connection it reads per request. So a failed read is logged and leaves `null`, which
 * skips the worker's signature-check timing, rather than failing jackson's start and with it every SAML sign-in; a
 * request after `IDP_VERIFICATION_RETRY_MS` reads them again (see `init`).
 */
const loadIdpVerification = async (connectionController: IConnectionAPIController): Promise<void> => {
  try {
    g.samlIdpVerification = await readIdpVerification(connectionController);
    g.samlIdpVerificationRetryAt = undefined;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? toLogText(error.message, JACKSON_LOG_TEXT_LIMIT) : undefined },
      "Could not read the SAML connection's certificates; the parse worker will not time signature checks"
    );
    g.samlIdpVerification = null;
    g.samlIdpVerificationRetryAt = Date.now() + IDP_VERIFICATION_RETRY_MS;
  }
};

export default async function init() {
  if (
    !g.oauthController ||
    !g.connectionController ||
    !g.samlDecryptionKey ||
    g.samlIdpVerification === undefined
  ) {
    const isSamlSsoEnabled = await getIsSamlSsoEnabled();
    if (!isSamlSsoEnabled) return;

    const opts: JacksonOption = {
      externalUrl: WEBAPP_URL,
      samlAudience: SAML_AUDIENCE,
      samlPath: SAML_PATH,
      db: {
        engine: "sql",
        type: "postgres",
        url: SAML_DATABASE_URL,
      },
      // jackson otherwise saves every failed callback, the whole decoded SAMLResponse included, for 7 days
      // (ENG-3976). The callback is anonymous, so that let anyone write a whole request body per request to this database,
      // and a real failed login kept the user's assertion. Nothing in Formbricks reads traces; the callback route
      // logs each failure with its identifiers instead (issuer, response ID, InResponseTo), and jackson's own
      // lines go through `jacksonLogger`.
      ssoTraces: { disable: true },
      // `idpEnabled` stays unset (off): the callback route only gives the parse worker jackson's key for responses to
      // sign-ins jackson started, which are the only ones it decrypts (ENG-4051). Turning IdP-initiated sign-in on
      // needs that route changed first, or encrypted IdP-initiated assertions reach jackson unmeasured.
      logger: { info: jacksonLogger("info"), warn: jacksonLogger("warn"), error: jacksonLogger("error") },
    };

    const [{ controllers }, x509] = await Promise.all([
      import("@boxyhq/saml-jackson"),
      import("@boxyhq/saml-jackson/dist/saml/x509"),
    ]);
    const ret = await controllers(opts);

    await preloadConnection(ret.connectionAPIController);
    await loadIdpVerification(ret.connectionAPIController);

    g.oauthController = ret.oauthController;
    g.connectionController = ret.connectionAPIController;
    // The private key jackson decrypts encrypted assertions with: its default SP certificate, which `controllers`
    // generated or loaded just now (ENG-4051). The SAML parse worker needs it to decrypt a response under the parse
    // budget before jackson does. It has to be read through this `x509`, the copy `controllers` set up: the build
    // bundles jackson once per server runtime, so a page and a route can each hold their own copy, and only the one
    // whose runtime ran `init` has a certificate store. Kept on the global object with the controllers, so every
    // runtime reads it from that copy.
    g.samlDecryptionKey = async () => (await x509.getDefaultCertificate()).privateKey;
  }

  // A failed certificate read is retried apart from jackson's start, one request at a time.
  const retryAt = g.samlIdpVerificationRetryAt;
  if (retryAt !== undefined && Date.now() >= retryAt && g.connectionController) {
    g.samlIdpVerificationRetryAt = Date.now() + IDP_VERIFICATION_RETRY_MS;
    await loadIdpVerification(g.connectionController);
  }

  return {
    oauthController: g.oauthController,
    connectionController: g.connectionController,
    getDecryptionKey: g.samlDecryptionKey,
    idpVerification: g.samlIdpVerification ?? null,
  };
}
