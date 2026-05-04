import { beforeEach, describe, expect, test, vi } from "vitest";
import { cache } from "@/lib/cache";
import {
  consumeSamlAuthnInstantForCode,
  getSamlAuthnInstantFromResponse,
  getSamlAuthnInstantFromXml,
  storeSamlAuthnInstantFromSamlResponse,
} from "./authn-instant";

vi.mock("@/lib/cache", () => ({
  cache: {
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("@boxyhq/saml20", () => ({
  default: {
    parseIssuer: vi.fn(),
    validateSignature: vi.fn(),
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

const saml20 = await import("@boxyhq/saml20");
const mockCache = vi.mocked(cache);
const mockSaml20 = vi.mocked(saml20.default);
const connectionController = {
  getConnections: vi.fn(),
};
const encodeSamlResponse = (xml: string) => Buffer.from(xml, "utf8").toString("base64");
const signedSamlResponse = `
  <saml:Assertion>
    <saml:AuthnStatement AuthnInstant="2026-05-04T12:30:00Z" />
  </saml:Assertion>
`;

describe("SAML AuthnInstant handoff", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCache.set.mockResolvedValue({ ok: true, data: undefined });
    mockCache.del.mockResolvedValue({ ok: true, data: undefined });
    mockSaml20.parseIssuer.mockReturnValue("https://idp.example.com/metadata");
    mockSaml20.validateSignature.mockReturnValue(signedSamlResponse);
    connectionController.getConnections.mockResolvedValue([
      {
        idpMetadata: {
          publicKey: "trusted-public-key",
        },
      },
    ]);
  });

  test("extracts and normalizes AuthnInstant from signed SAML XML", () => {
    expect(getSamlAuthnInstantFromXml(signedSamlResponse)).toBe("2026-05-04T12:30:00.000Z");
  });

  test("extracts AuthnInstant from the signature-validated SAML response", async () => {
    const samlResponse = `
      <samlp:Response>
        <saml:Assertion>
          <saml:AuthnStatement AuthnInstant="2026-05-04T12:00:00Z" />
        </saml:Assertion>
      </samlp:Response>
    `;

    await expect(
      getSamlAuthnInstantFromResponse({
        connectionController: connectionController as any,
        samlResponse: encodeSamlResponse(samlResponse),
      })
    ).resolves.toBe("2026-05-04T12:30:00.000Z");
    expect(mockSaml20.validateSignature).toHaveBeenCalledWith(samlResponse, "trusted-public-key", null);
  });

  test("stores signed AuthnInstant by the one-time OAuth code from the Jackson redirect", async () => {
    const samlResponse = encodeSamlResponse(`
      <samlp:Response>
        <saml:Assertion>
          <saml:AuthnStatement AuthnInstant="2026-05-04T12:30:00Z" />
        </saml:Assertion>
      </samlp:Response>
    `);

    await storeSamlAuthnInstantFromSamlResponse({
      connectionController: connectionController as any,
      redirectUrl: "http://localhost:3000/api/auth/callback/saml?code=oauth-code&state=state",
      samlResponse,
    });

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.any(String),
      { authnInstant: "2026-05-04T12:30:00.000Z" },
      5 * 60 * 1000
    );
  });

  test("does not store when the signed SAML XML has no AuthnInstant", async () => {
    mockSaml20.validateSignature.mockReturnValue("<saml:Assertion />");

    await storeSamlAuthnInstantFromSamlResponse({
      connectionController: connectionController as any,
      redirectUrl: "http://localhost:3000/api/auth/callback/saml?code=oauth-code&state=state",
      samlResponse: encodeSamlResponse("<samlp:Response />"),
    });

    expect(mockCache.set).not.toHaveBeenCalled();
  });

  test("does not store when the SAML signature cannot be validated with known IdP metadata", async () => {
    mockSaml20.validateSignature.mockReturnValue(null);

    await storeSamlAuthnInstantFromSamlResponse({
      connectionController: connectionController as any,
      redirectUrl: "http://localhost:3000/api/auth/callback/saml?code=oauth-code&state=state",
      samlResponse: encodeSamlResponse("<samlp:Response />"),
    });

    expect(mockCache.set).not.toHaveBeenCalled();
  });

  test("consumes a stored AuthnInstant for the token response", async () => {
    mockCache.get.mockResolvedValue({
      ok: true,
      data: {
        authnInstant: "2026-05-04T12:30:00.000Z",
      },
    });

    await expect(consumeSamlAuthnInstantForCode("oauth-code")).resolves.toBe("2026-05-04T12:30:00.000Z");

    expect(mockCache.del).toHaveBeenCalledWith([expect.any(String)]);
  });
});
