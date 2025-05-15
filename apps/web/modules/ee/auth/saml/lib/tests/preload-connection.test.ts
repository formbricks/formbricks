import { SAML_PRODUCT, SAML_TENANT, SAML_XML_DIR, WEBAPP_URL } from "@/lib/constants";
import fs from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { preloadConnection } from "../preload-connection";

vi.mock("@/lib/constants", () => ({
  SAML_PRODUCT: "test-product",
  SAML_TENANT: "test-tenant",
  SAML_XML_DIR: "test-xml-dir",
  WEBAPP_URL: "https://test-webapp-url.com",
}));

vi.mock("fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock("path", () => ({
  default: {
    join: vi.fn(),
  },
}));

vi.mock("@boxyhq/saml-jackson", () => ({
  SAMLSSOConnectionWithEncodedMetadata: vi.fn(),
}));

vi.mock("@boxyhq/saml-jackson/dist/controller/api", () => ({
  ConnectionAPIController: vi.fn(),
}));

describe("SAML Preload Connection", () => {
  const mockConnectionController = {
    getConnections: vi.fn(),
    createSAMLConnection: vi.fn(),
    deleteConnections: vi.fn(),
  };

  const mockMetadata = "<EntityDescriptor>SAML Metadata</EntityDescriptor>";
  const mockEncodedMetadata = Buffer.from(mockMetadata, "utf8").toString("base64");

  const mockExistingConnection = {
    clientID: "existing-client-id",
    clientSecret: "existing-client-secret",
    product: SAML_PRODUCT,
    tenant: SAML_TENANT,
  };

  const mockNewConnection = {
    clientID: "new-client-id",
    clientSecret: "new-client-secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));

    vi.mocked(fs.readdir).mockResolvedValue(["metadata.xml", "other-file.txt"] as any);

    vi.mocked(fs.readFile).mockResolvedValue(mockMetadata as any);

    mockConnectionController.getConnections.mockResolvedValue([mockExistingConnection]);

    mockConnectionController.createSAMLConnection.mockResolvedValue(mockNewConnection);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("preload connection from XML file", async () => {
    await preloadConnection(mockConnectionController as any);

    expect(fs.readdir).toHaveBeenCalledWith(path.join(SAML_XML_DIR));

    expect(fs.readFile).toHaveBeenCalledWith(path.join(SAML_XML_DIR, "metadata.xml"), "utf8");

    expect(mockConnectionController.getConnections).toHaveBeenCalledWith({
      tenant: SAML_TENANT,
      product: SAML_PRODUCT,
    });

    expect(mockConnectionController.createSAMLConnection).toHaveBeenCalledWith({
      name: "SAML SSO",
      defaultRedirectUrl: `${WEBAPP_URL}/auth/login`,
      redirectUrl: [`${WEBAPP_URL}/*`],
      tenant: SAML_TENANT,
      product: SAML_PRODUCT,
      encodedRawMetadata: mockEncodedMetadata,
    });

    expect(mockConnectionController.deleteConnections).toHaveBeenCalledWith({
      clientID: mockExistingConnection.clientID,
      clientSecret: mockExistingConnection.clientSecret,
      product: mockExistingConnection.product,
      tenant: mockExistingConnection.tenant,
    });
  });

  test("not delete existing connection if client IDs match", async () => {
    mockConnectionController.createSAMLConnection.mockResolvedValue({
      clientID: mockExistingConnection.clientID,
    });

    await preloadConnection(mockConnectionController as any);

    expect(mockConnectionController.deleteConnections).not.toHaveBeenCalled();
  });

  test("handle case when no XML files are found", async () => {
    vi.mocked(fs.readdir).mockResolvedValue(["other-file.txt"] as any);

    const loggerSpy = vi.spyOn(logger, "error");

    await preloadConnection(mockConnectionController as any);

    expect(loggerSpy).toHaveBeenCalledWith(expect.any(Error), "Error preloading connection");

    expect(mockConnectionController.createSAMLConnection).not.toHaveBeenCalled();
  });

  test("handle invalid metadata", async () => {
    const errorMessage = "Invalid metadata";
    mockConnectionController.createSAMLConnection.mockRejectedValue(new Error(errorMessage));

    const loggerSpy = vi.spyOn(logger, "error");

    await preloadConnection(mockConnectionController as any);

    expect(loggerSpy).toHaveBeenCalledWith(expect.any(Error), "Error preloading connection");
  });
});
