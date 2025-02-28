"use server";

import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import type { IConnectionAPIController, IOAuthController, JacksonOption } from "@boxyhq/saml-jackson";
import { SAML_AUDIENCE, SAML_DATABASE_URL, SAML_PATH, WEBAPP_URL } from "@formbricks/lib/constants";

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
}

const g = global;

export default async function init() {
  if (!g.oauthController || !g.connectionController) {
    const isSamlSsoEnabled = await getIsSamlSsoEnabled();
    if (!isSamlSsoEnabled) return;

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
