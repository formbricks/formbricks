"use server";

import type { IConnectionAPIController, IOAuthController, JacksonOption } from "@boxyhq/saml-jackson";
import { SAML_AUDIENCE, SAML_DATABASE_URL, SAML_PATH, WEBAPP_URL } from "@/lib/constants";
import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";

declare global {
  var oauthController: IOAuthController | undefined;
  var connectionController: IConnectionAPIController | undefined;
}

const g = global;

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
      // (ENG-3976). The callback is anonymous, so that let anyone write ~200 KiB per request to this database,
      // and a real failed login kept the user's assertion. Nothing in Formbricks reads traces, and jackson's
      // errors still reach the log.
      ssoTraces: { disable: true },
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
