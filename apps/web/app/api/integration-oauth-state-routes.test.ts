import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET as googleSheetsCallbackGET } from "@/app/api/google-sheet/callback/route";
import { GET as googleSheetsGET } from "@/app/api/google-sheet/route";
import { GET as airtableCallbackGET } from "@/app/api/v1/integrations/airtable/callback/route";
import { GET as airtableGET } from "@/app/api/v1/integrations/airtable/route";
import { GET as notionCallbackGET } from "@/app/api/v1/integrations/notion/callback/route";
import { GET as notionGET } from "@/app/api/v1/integrations/notion/route";
import { GET as slackCallbackGET } from "@/app/api/v1/integrations/slack/callback/route";
import { GET as slackGET } from "@/app/api/v1/integrations/slack/route";
import { fetchAirtableAuthToken } from "@/lib/airtable/service";
import {
  IntegrationOAuthStateError,
  consumeIntegrationOAuthState,
  createIntegrationOAuthState,
  generatePkcePair,
} from "@/lib/oauth/integration-state";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";

const mocks = vi.hoisted(() => {
  class MockIntegrationOAuthStateError extends Error {
    constructor(message = "Invalid OAuth state") {
      super(message);
      this.name = "IntegrationOAuthStateError";
    }
  }

  return {
    fetchMock: vi.fn(),
    googleGenerateAuthUrl: vi.fn(),
    googleGetToken: vi.fn(),
    googleOAuth2: vi.fn(function GoogleOAuth2() {
      return {
        generateAuthUrl: mocks.googleGenerateAuthUrl,
        getToken: mocks.googleGetToken,
        setCredentials: vi.fn(),
      };
    }),
    mockIntegrationOAuthStateError: MockIntegrationOAuthStateError,
  };
});

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: mocks.googleOAuth2,
    },
    oauth2: vi.fn(() => ({
      userinfo: {
        get: vi.fn(),
      },
    })),
  },
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper:
    ({ handler }: any) =>
    async (req: NextRequest) => {
      const result = await handler({
        authentication: { user: { id: "user-1" } },
        req,
      });
      return result.response;
    },
}));

vi.mock("@/lib/airtable/service", () => ({
  fetchAirtableAuthToken: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    AIRTABLE_CLIENT_ID: "airtable-client-id",
    GOOGLE_SHEETS_CLIENT_ID: "google-client-id",
    GOOGLE_SHEETS_CLIENT_SECRET: "google-client-secret",
    GOOGLE_SHEETS_REDIRECT_URL: "http://localhost:3000/api/google-sheet/callback",
    NOTION_AUTH_URL:
      "https://api.notion.com/v1/oauth/authorize?client_id=notion-client-id&response_type=code",
    NOTION_OAUTH_CLIENT_ID: "notion-client-id",
    NOTION_OAUTH_CLIENT_SECRET: "notion-client-secret",
    NOTION_REDIRECT_URI: "http://localhost:3000/api/v1/integrations/notion/callback",
    SLACK_AUTH_URL: "https://slack.com/oauth/v2/authorize?client_id=slack-client-id",
    SLACK_CLIENT_ID: "slack-client-id",
    SLACK_CLIENT_SECRET: "slack-client-secret",
    SLACK_REDIRECT_URI: "http://localhost:3000/api/v1/integrations/slack/callback",
    WEBAPP_URL: "http://localhost:3000",
  };
});

vi.mock("@/lib/oauth/integration-state", () => ({
  IntegrationOAuthStateError: mocks.mockIntegrationOAuthStateError,
  consumeIntegrationOAuthState: vi.fn(),
  createIntegrationOAuthState: vi.fn(),
  generatePkcePair: vi.fn(),
  getSafeOAuthCallbackError: vi.fn((error: string | null) => error),
}));

vi.mock("@/lib/workspace/auth", () => ({
  hasUserWorkspaceAccess: vi.fn(),
}));

vi.stubGlobal("fetch", mocks.fetchMock);

const mockGetServerSession = vi.mocked(getServerSession);
const mockCreateIntegrationOAuthState = vi.mocked(createIntegrationOAuthState);
const mockConsumeIntegrationOAuthState = vi.mocked(consumeIntegrationOAuthState);
const mockGeneratePkcePair = vi.mocked(generatePkcePair);
const mockHasUserWorkspaceAccess = vi.mocked(hasUserWorkspaceAccess);
const mockFetchAirtableAuthToken = vi.mocked(fetchAirtableAuthToken);

const workspaceId = "workspace-1";
const opaqueState = "opaque-oauth-state";

const nextRequest = (url: string) =>
  new NextRequest(url, {
    headers: {
      workspaceId,
    },
  });

const expectOpaqueStateInAuthUrl = async (response: Response) => {
  expect(response.status).toBe(200);
  const body = await response.json();
  const authUrl = new URL(body.data.authUrl);
  expect(authUrl.searchParams.get("state")).toBe(opaqueState);
  expect(authUrl.searchParams.get("state")).not.toBe(workspaceId);
};

describe("integration OAuth state route wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockHasUserWorkspaceAccess.mockResolvedValue(true);
    mockCreateIntegrationOAuthState.mockResolvedValue(opaqueState);
    mockConsumeIntegrationOAuthState.mockResolvedValue({
      createdAt: Date.now(),
      provider: "slack",
      userId: "user-1",
      workspaceId,
    } as any);
    mockGeneratePkcePair.mockReturnValue({
      codeChallenge: "airtable-code-challenge",
      codeChallengeMethod: "S256",
      codeVerifier: "airtable-code-verifier",
    });
    mocks.googleGenerateAuthUrl.mockImplementation((params) => {
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("state", params.state);
      return authUrl.toString();
    });
  });

  test("uses opaque OAuth state for all integration start routes", async () => {
    await expectOpaqueStateInAuthUrl(
      await googleSheetsGET(nextRequest("http://localhost:3000/api/google-sheet"))
    );
    await expectOpaqueStateInAuthUrl(
      await slackGET(nextRequest("http://localhost:3000/api/v1/integrations/slack"), {} as never)
    );
    await expectOpaqueStateInAuthUrl(
      await notionGET(nextRequest("http://localhost:3000/api/v1/integrations/notion"), {} as never)
    );
    await expectOpaqueStateInAuthUrl(
      await airtableGET(nextRequest("http://localhost:3000/api/v1/integrations/airtable"), {} as never)
    );

    expect(mockCreateIntegrationOAuthState).toHaveBeenCalledWith({
      provider: "googleSheets",
      userId: "user-1",
      workspaceId,
    });
    expect(mockCreateIntegrationOAuthState).toHaveBeenCalledWith({
      provider: "slack",
      userId: "user-1",
      workspaceId,
    });
    expect(mockCreateIntegrationOAuthState).toHaveBeenCalledWith({
      provider: "notion",
      userId: "user-1",
      workspaceId,
    });
    expect(mockCreateIntegrationOAuthState).toHaveBeenCalledWith({
      pkceCodeVerifier: "airtable-code-verifier",
      provider: "airtable",
      userId: "user-1",
      workspaceId,
    });
  });

  test("rejects forged callback state before token exchange for all integrations", async () => {
    mockConsumeIntegrationOAuthState.mockRejectedValue(new IntegrationOAuthStateError());

    const googleResponse = await googleSheetsCallbackGET(
      new Request(`http://localhost:3000/api/google-sheet/callback?state=${workspaceId}&code=code`)
    );
    const slackResponse = await slackCallbackGET(
      nextRequest(`http://localhost:3000/api/v1/integrations/slack/callback?state=${workspaceId}&code=code`),
      {} as never
    );
    const notionResponse = await notionCallbackGET(
      nextRequest(`http://localhost:3000/api/v1/integrations/notion/callback?state=${workspaceId}&code=code`),
      {} as never
    );
    const airtableResponse = await airtableCallbackGET(
      nextRequest(
        `http://localhost:3000/api/v1/integrations/airtable/callback?state=${workspaceId}&code=code`
      ),
      {} as never
    );

    expect(googleResponse.status).toBe(400);
    expect(slackResponse.status).toBe(400);
    expect(notionResponse.status).toBe(400);
    expect(airtableResponse.status).toBe(400);
    expect(mocks.googleGetToken).not.toHaveBeenCalled();
    expect(mocks.fetchMock).not.toHaveBeenCalled();
    expect(mockFetchAirtableAuthToken).not.toHaveBeenCalled();
  });

  test("rejects valid callback state when workspace access was revoked", async () => {
    mockHasUserWorkspaceAccess.mockResolvedValue(false);
    mockConsumeIntegrationOAuthState.mockResolvedValue({
      createdAt: Date.now(),
      pkceCodeVerifier: "airtable-code-verifier",
      provider: "airtable",
      userId: "user-1",
      workspaceId,
    } as any);

    const googleResponse = await googleSheetsCallbackGET(
      new Request(`http://localhost:3000/api/google-sheet/callback?state=${opaqueState}&code=code`)
    );
    const slackResponse = await slackCallbackGET(
      nextRequest(`http://localhost:3000/api/v1/integrations/slack/callback?state=${opaqueState}&code=code`),
      {} as never
    );
    const notionResponse = await notionCallbackGET(
      nextRequest(`http://localhost:3000/api/v1/integrations/notion/callback?state=${opaqueState}&code=code`),
      {} as never
    );
    const airtableResponse = await airtableCallbackGET(
      nextRequest(
        `http://localhost:3000/api/v1/integrations/airtable/callback?state=${opaqueState}&code=code`
      ),
      {} as never
    );

    expect(googleResponse.status).toBe(401);
    expect(slackResponse.status).toBe(401);
    expect(notionResponse.status).toBe(401);
    expect(airtableResponse.status).toBe(401);
    expect(mocks.googleGetToken).not.toHaveBeenCalled();
    expect(mocks.fetchMock).not.toHaveBeenCalled();
    expect(mockFetchAirtableAuthToken).not.toHaveBeenCalled();
  });
});
