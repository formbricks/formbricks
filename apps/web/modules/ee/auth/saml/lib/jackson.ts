"use server";

import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import type { IConnectionAPIController, IOAuthController, JacksonOption } from "@boxyhq/saml-jackson";
import { ConnectionAPIController } from "@boxyhq/saml-jackson/dist/controller/api";
import { SAML_AUDIENCE, SAML_DATABASE_URL, SAML_PATH, WEBAPP_URL } from "@formbricks/lib/constants";

const opts: JacksonOption = {
  externalUrl: WEBAPP_URL,
  samlAudience: SAML_AUDIENCE,
  // TODO: uncomment this when boxyHQ fixes this, Error: Cannot find module as expression is too dynamic
  // preLoadedConnection: "./modules/ee/auth/saml/pre-loaded",
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
}

const g = global;

export default async function init() {
  if (!g.oauthController || !g.connectionController) {
    const ret = await (await import("@boxyhq/saml-jackson")).controllers(opts);

    g.oauthController = ret.oauthController;
    g.connectionController = ret.connectionAPIController;
  }
  await preloadConnection(g.connectionController as ConnectionAPIController);

  return {
    oauthController: g.oauthController,
    connectionController: g.connectionController,
  };
}
