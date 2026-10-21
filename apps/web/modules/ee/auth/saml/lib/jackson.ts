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
  if (!g.oauthController || !g.connectionController) {
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
      logger: { info: jacksonLogger("info"), warn: jacksonLogger("warn"), error: jacksonLogger("error") },
    };

    const ret = await (await import("@boxyhq/saml-jackson")).controllers(opts);

    await preloadConnection(ret.connectionAPIController);

    g.oauthController = ret.oauthController;
    g.connectionController = ret.connectionAPIController;
  }

  return {
    oauthController: g.oauthController,
    connectionController: g.connectionController,
  };
}
