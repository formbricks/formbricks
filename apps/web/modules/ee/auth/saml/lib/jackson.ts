"use server";

import { SAML_AUDIENCE, SAML_DATABASE_URL, SAML_PATH, WEBAPP_URL } from "@/lib/constants";
import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import type {
  IConnectionAPIController,
  IOAuthController,
  ISPSSOConfig,
  JacksonOption,
} from "@boxyhq/saml-jackson";

const opts: JacksonOption = {
  externalUrl: WEBAPP_URL,
  samlAudience: SAML_AUDIENCE,
  samlPath: SAML_PATH,
  db: {
    engine: "sql",
    type: "postgres",
    url: SAML_DATABASE_URL,
  },
};

declare global {
  var oauthController: IOAuthController | undefined;
  var connectionController: IConnectionAPIController | undefined;
  var spConfig: ISPSSOConfig | undefined;
}

const g = global;

export default async function init() {
  if (!g.oauthController || !g.connectionController || !g.spConfig) {
    const isSamlSsoEnabled = await getIsSamlSsoEnabled();
    if (!isSamlSsoEnabled) return;

    const ret = await (await import("@boxyhq/saml-jackson")).controllers(opts);

    await preloadConnection(ret.connectionAPIController);

    g.oauthController = ret.oauthController;
    g.connectionController = ret.connectionAPIController;
    g.spConfig = ret.spConfig;
  }

  return {
    oauthController: g.oauthController,
    connectionController: g.connectionController,
    spConfig: g.spConfig,
  };
}
