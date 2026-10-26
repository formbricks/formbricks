import "server-only";
import type { IConnectionAPIController, IOAuthController, JacksonOption } from "@boxyhq/saml-jackson";
import { logger } from "@formbricks/logger";
import { SAML_AUDIENCE, SAML_DATABASE_URL, SAML_PATH, WEBAPP_URL } from "@/lib/constants";
import { toLogText } from "@/lib/utils/strings";
import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";

declare global {
  var oauthController: IOAuthController | undefined;
  var connectionController: IConnectionAPIController | undefined;
  var samlDecryptionKey: (() => Promise<string>) | undefined;
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

export default async function init() {
  if (!g.oauthController || !g.connectionController || !g.samlDecryptionKey) {
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

  return {
    oauthController: g.oauthController,
    connectionController: g.connectionController,
    getDecryptionKey: g.samlDecryptionKey,
  };
}
