import { describe, expect, test, vi } from "vitest";
import {
  LOOPBACK_REGISTRATION,
  REGISTER_PATH,
  createAuthInstance,
  registrationRequest,
  throughRoute,
} from "./mcp-oauth-dcr-test-utils";

// As in mcp-oauth-dcr.test.ts: env-dependent URLs pinned, and the grant claim (PostgreSQL) stubbed.
vi.mock("./mcp-grant-token-claim", () => ({ mcpGrantAccessTokenClaims: vi.fn(async () => ({})) }));
vi.mock("@/lib/env", () => ({
  env: {
    WEBAPP_URL: "http://localhost:3000",
    BETTER_AUTH_URL: undefined,
    NEXTAUTH_URL: undefined,
    PUBLIC_URL: undefined,
    MCP_DCR_ALLOWED_REDIRECT_URIS: undefined,
  },
}));

/**
 * ENG-3533. A registered `backchannel_logout_uri` is a URL the Formbricks server itself POSTs a signed
 * `logout_token` to when a user who authorized the client signs out. Upstream only checks the literal
 * hostname, so a DNS name resolving to an internal address passes, and anyone can trigger the request
 * with their own account. No MCP client uses back-channel logout, so the anonymous gate refuses both
 * back-channel fields outright.
 */
describe("DCR back-channel logout vs. the real plugin (ENG-3533)", () => {
  const BACKCHANNEL_LOGOUT_URI = "https://internal-name.attacker.example.org/logout";
  // Declared native, so upstream alone accepts the loopback callback without the gate's inference.
  const withField = (field: Record<string, unknown>) =>
    JSON.stringify({
      ...(JSON.parse(LOOPBACK_REGISTRATION) as Record<string, unknown>),
      application_type: "native",
      ...field,
    });

  test("upstream alone registers a client with a back-channel logout URI", async () => {
    const response = await createAuthInstance().handler(
      registrationRequest(REGISTER_PATH, withField({ backchannel_logout_uri: BACKCHANNEL_LOGOUT_URI }))
    );
    const body = (await response.json()) as { client_id?: string; backchannel_logout_uri?: string };

    // What the gate is measured against: the jwt plugin is on, so upstream stores the URI.
    expect(response.status).toBe(201);
    expect(body.backchannel_logout_uri).toBe(BACKCHANNEL_LOGOUT_URI);
  });

  test.each([
    ["backchannel_logout_uri", { backchannel_logout_uri: BACKCHANNEL_LOGOUT_URI }],
    ["backchannel_logout_session_required", { backchannel_logout_session_required: true }],
  ])("the gate rejects a registration that sets %s", async (_label, field) => {
    const response = await throughRoute(
      createAuthInstance(),
      registrationRequest(REGISTER_PATH, withField(field))
    );
    const body = (await response.json()) as { error?: string; client_id?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_client_metadata");
    expect(body.client_id).toBeUndefined();
  });

  test("a registration without back-channel fields still registers", async () => {
    const response = await throughRoute(
      createAuthInstance(),
      registrationRequest(REGISTER_PATH, LOOPBACK_REGISTRATION)
    );

    expect(response.status).toBe(201);
  });
});
