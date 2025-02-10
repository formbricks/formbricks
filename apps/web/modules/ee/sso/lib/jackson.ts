import jackson, {
  IConnectionAPIController,
  type IOAuthController,
  type JacksonOption,
} from "@boxyhq/saml-jackson";

const samlAudience = "https://saml.boxyhq.com";
const samlPath = "/api/auth/saml/callback";

const opts: JacksonOption = {
  externalUrl: `${process.env.NEXTAUTH_URL}`,
  samlAudience,
  samlPath,
  db: {
    engine: "sql",
    type: "postgres",
    url: "postgres://postgres:postgres@localhost:5432/formbricks-saml",
  },
};

declare global {
  var oauthController: IOAuthController | undefined;
  var connectionController: IConnectionAPIController | undefined;
}

const g = global;

export default async function init() {
  if (!g.oauthController || !g.connectionController) {
    const ret = await jackson(opts);
    g.oauthController = ret.oauthController;
    g.connectionController = ret.connectionAPIController;
  }

  return {
    oauthController: g.oauthController,
    connectionController: g.connectionController,
  };
}
