import { controllers } from "@boxyhq/saml-jackson";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  SAML_AUDIENCE,
  SAML_DATABASE_URL,
  SAML_PATH,
  SAML_PRODUCT,
  SAML_TENANT,
  WEBAPP_URL,
} from "@/lib/constants";
import { preloadConnection } from "@/modules/ee/auth/saml/lib/preload-connection";
import { getIsSamlSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import init from "../jackson";

vi.mock("@/lib/constants", () => ({
  SAML_AUDIENCE: "test-audience",
  SAML_DATABASE_URL: "test-db-url",
  SAML_PATH: "/test-path",
  SAML_TENANT: "test-tenant",
  SAML_PRODUCT: "test-product",
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
  const getConnections = vi.fn();
  const mockConnectionController = { name: "mockConnectionController", getConnections };

  beforeEach(() => {
    vi.clearAllMocks();

    global.oauthController = undefined;
    global.connectionController = undefined;
    global.samlDecryptionKey = undefined;
    global.samlIdpVerification = undefined;
    global.samlIdpVerificationRetryAt = undefined;
    // The connection preloadConnection configured, with two certificates as during an IdP rollover.
    getConnections.mockResolvedValue([{ idpMetadata: { publicKey: "cert-a,cert-b", thumbprint: "t" } }]);

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
      getDecryptionKey: global.samlDecryptionKey,
      // Every certificate, as jackson checks with them; the thumbprint only when there are none (ENG-4108).
      idpVerification: { publicKey: "cert-a,cert-b" },
    });
    expect(global.samlDecryptionKey).toEqual(expect.any(Function));
    expect(getConnections).toHaveBeenCalledWith({ tenant: SAML_TENANT, product: SAML_PRODUCT });
  });

  test.each([
    [
      "the thumbprint, for a connection with no certificate",
      [{ idpMetadata: { thumbprint: "t" } }],
      { thumbprint: "t" },
    ],
    ["nothing, with no connection, which jackson refuses before validating", [], null],
    ["nothing, for an OIDC connection", [{ oidcProvider: {} }], null],
  ])("hands the parse worker %s", async (_name, connections, expected) => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    getConnections.mockResolvedValue(connections);

    const result = await init();

    expect(result?.idpVerification).toEqual(expected);
  });

  test("starts without the certificates, and logs it, when the connection cannot be read", async () => {
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    getConnections.mockRejectedValue(new Error("connection refused"));
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    const result = await init();

    // jackson still starts; only the worker's signature-check timing is skipped.
    expect(result?.oauthController).toBeDefined();
    expect(result?.idpVerification).toBeNull();
    expect(error).toHaveBeenCalledWith(
      { error: "connection refused" },
      "Could not read the SAML connection's certificates; the parse worker will not time signature checks"
    );
  });

  test("reads the certificates again after a failed read, at most once per retry interval", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
      vi.spyOn(logger, "error").mockImplementation(() => undefined);
      getConnections.mockRejectedValueOnce(new Error("connection refused"));
      expect((await init())?.idpVerification).toBeNull();

      // Within the interval, no request reads again, and jackson is not started again either.
      vi.advanceTimersByTime(29_000);
      expect((await init())?.idpVerification).toBeNull();
      expect(getConnections).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1_000);
      expect((await init())?.idpVerification).toEqual({ publicKey: "cert-a,cert-b" });
      expect(getConnections).toHaveBeenCalledTimes(2);
      expect(controllers).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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
    const decryptionKey = async () => "sp-private-key";
    global.samlDecryptionKey = decryptionKey;
    global.samlIdpVerification = { publicKey: "cert-a" };

    const result = await init();

    expect(getIsSamlSsoEnabled).not.toHaveBeenCalled();

    expect(controllers).not.toHaveBeenCalled();

    expect(preloadConnection).not.toHaveBeenCalled();

    expect(result).toEqual({
      oauthController: mockOAuthController,
      connectionController: mockConnectionController,
      getDecryptionKey: decryptionKey,
      idpVerification: { publicKey: "cert-a" },
    });
    expect(getConnections).not.toHaveBeenCalled();
  });

  test("initializes again when the controllers are kept but the decryption key is not", async () => {
    // A `next dev` reload keeps globals an older version of this module set, without the key's getter.
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    global.oauthController = mockOAuthController as any;
    global.connectionController = mockConnectionController as any;

    const result = await init();

    expect(controllers).toHaveBeenCalledTimes(1);
    expect(result?.getDecryptionKey).toEqual(expect.any(Function));
  });
});
