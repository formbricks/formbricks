import { SAML_AUDIENCE, SAML_DATABASE_URL, SAML_PATH, WEBAPP_URL } from "@/lib/constants";
import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { controllers } from "@boxyhq/saml-jackson";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
    });

    expect(preloadConnection).toHaveBeenCalledWith(mockConnectionController);

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
