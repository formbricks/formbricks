import { controllers } from "@boxyhq/saml-jackson";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { SAML_AUDIENCE, SAML_DATABASE_URL, SAML_PATH, WEBAPP_URL } from "@/lib/constants";
import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import init from "../jackson";

vi.mock("@/lib/constants", () => ({
  SAML_AUDIENCE: "test-audience",
  SAML_DATABASE_URL: "test-db-url",
  SAML_PATH: "/test-path",
  WEBAPP_URL: "https://test-webapp-url.com",
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSamlSsoEnabled: vi.fn(),
}));

vi.mock("@/modules/ee/auth/saml/lib/preload-connection", () => ({
  preloadConnection: vi.fn(),
}));

vi.mock("@boxyhq/saml-jackson", () => ({
  controllers: vi.fn(),
}));

describe("SAML Jackson Initialization", () => {
  const mockOAuthController = { name: "mockOAuthController" };
  const mockConnectionController = { name: "mockConnectionController" };

  beforeEach(() => {
    vi.clearAllMocks();

    global.oauthController = undefined;
    global.connectionController = undefined;

    vi.mocked(controllers).mockResolvedValue({
      oauthController: mockOAuthController,
      connectionAPIController: mockConnectionController,
    } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("initialize controllers when SAML SSO is enabled", async () => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);

    const result = await init();

    expect(getIsSamlSsoEnabled).toHaveBeenCalledTimes(1);

    expect(controllers).toHaveBeenCalledWith({
      externalUrl: WEBAPP_URL,
      samlAudience: SAML_AUDIENCE,
      samlPath: SAML_PATH,
      db: {
        engine: "sql",
        type: "postgres",
        url: SAML_DATABASE_URL,
      },
      // An anonymous failed callback must not persist its SAMLResponse (ENG-3976).
      ssoTraces: { disable: true },
      logger: { info: expect.any(Function), warn: expect.any(Function), error: expect.any(Function) },
    });

    expect(preloadConnection).toHaveBeenCalledWith(mockConnectionController);

    // jackson's own lines go through Formbricks' logger, capped and stripped like any untrusted text.
    const jacksonLogger = vi.mocked(controllers).mock.calls[0][0].logger!;
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    // A response that fails validation is the sender's fault: a warning, like the route's own line for it.
    jacksonLogger.error!(`SAMLResponse error: ${"x".repeat(1000)}\n`, new Error("inner\u202etext"));
    expect(warn).toHaveBeenCalledWith(
      { source: "saml-jackson", error: "inner?text" },
      expect.stringMatching(/^SAMLResponse error: x{480}/)
    );
    expect((warn.mock.calls[0][1] as string).length).toBeLessThanOrEqual(503);

    // Anything else jackson reports as an error stays one.
    jacksonLogger.error!("Error connecting to the database");
    expect(error).toHaveBeenCalledWith(
      { source: "saml-jackson", error: undefined },
      "Error connecting to the database"
    );

    expect(global.oauthController).toBe(mockOAuthController);
    expect(global.connectionController).toBe(mockConnectionController);

    expect(result).toEqual({
      oauthController: mockOAuthController,
      connectionController: mockConnectionController,
    });
  });

  test("return early when SAML SSO is disabled", async () => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);

    const result = await init();

    expect(getIsSamlSsoEnabled).toHaveBeenCalledTimes(1);

    expect(controllers).not.toHaveBeenCalled();

    expect(preloadConnection).not.toHaveBeenCalled();

    expect(global.oauthController).toBeUndefined();
    expect(global.connectionController).toBeUndefined();

    expect(result).toBeUndefined();
  });

  test("reuse existing controllers if already initialized", async () => {
    global.oauthController = mockOAuthController as any;
    global.connectionController = mockConnectionController as any;

    const result = await init();

    expect(getIsSamlSsoEnabled).not.toHaveBeenCalled();

    expect(controllers).not.toHaveBeenCalled();

    expect(preloadConnection).not.toHaveBeenCalled();

    expect(result).toEqual({
      oauthController: mockOAuthController,
      connectionController: mockConnectionController,
    });
  });
});
