import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readConsentedScopes } from "@/modules/auth/lib/oauth-grant-revocation";
import { listMcpGrantAccessOptions } from "./access-options";
import { editMcpGrant, listMcpConnections } from "./connections";
import type { TMcpGrantAccessSelection } from "./grant";
import { type TStoredMcpGrant, hasMcpGrant, projectMcpGrants, saveMcpGrant } from "./grant-store";

vi.mock("@/modules/auth/lib/oauth-grant-revocation", () => ({ readConsentedScopes: vi.fn() }));
vi.mock("./access-options", () => ({ listMcpGrantAccessOptions: vi.fn() }));
vi.mock("./grant-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./grant-store")>()),
  hasMcpGrant: vi.fn(),
  projectMcpGrants: vi.fn(),
  saveMcpGrant: vi.fn(),
}));

const USER_ID = "user-1";
const CLIENT_ID = "client-1";

const at = (iso: string): Date => new Date(iso);

const consent = (
  overrides: Partial<{ id: string; clientId: string; scopes: string[]; createdAt: Date; updatedAt: Date }>
) => ({
  id: "consent-1",
  clientId: CLIENT_ID,
  scopes: ["surveys:write"],
  createdAt: at("2026-01-01T00:00:00Z"),
  updatedAt: at("2026-01-02T00:00:00Z"),
  client: { name: "Client", uri: "https://client.example" },
  ...overrides,
});

const stored = (overrides: Partial<TStoredMcpGrant> = {}): TStoredMcpGrant =>
  ({
    id: "grant-1",
    userId: USER_ID,
    clientId: CLIENT_ID,
    permissions: { surveys: "read" },
    access: "all",
    ...overrides,
  }) as TStoredMcpGrant;

describe("listMcpConnections", () => {
  test("folds duplicate consents into one connection, keeping the newest's scopes and the oldest's date", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ id: "consent-new", scopes: ["surveys:write"], createdAt: at("2026-03-01T00:00:00Z") }),
      consent({ id: "consent-old", scopes: ["surveys:read"], createdAt: at("2026-01-01T00:00:00Z") }),
      consent({ id: "consent-mid", scopes: ["surveys:read"], createdAt: at("2026-02-01T00:00:00Z") }),
    ] as never);
    prisma.mcpGrant.findMany.mockResolvedValue([]);

    const [connection, ...rest] = await listMcpConnections(USER_ID, { isDashboardViewer: false });

    expect(rest).toHaveLength(0);
    expect(connection).toMatchObject({
      consentId: "consent-new",
      connectedAt: at("2026-01-01T00:00:00Z"),
      permissions: null,
      access: null,
      cap: { surveys: "write", creatives: "write", surveyStyling: "write" },
    });
    expect(prisma.oauthConsent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
    expect(prisma.mcpGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
  });

  test("shows the grant's permissions and access, with the later of the consent's and grant's change", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ clientId: "client-a", updatedAt: at("2026-01-05T00:00:00Z") }),
      consent({ id: "consent-b", clientId: "client-b", updatedAt: at("2026-01-04T00:00:00Z") }),
    ] as never);
    prisma.mcpGrant.findMany.mockResolvedValue([
      {
        clientId: "client-b",
        permissions: { surveys: "read", bogus: "write" },
        updatedAt: at("2026-01-09T00:00:00Z"),
        access: "workspaces",
        organizations: [{ organizationId: "org-stray" }],
        workspaces: [{ workspaceId: "ws-1" }],
      },
      {
        clientId: "client-a",
        permissions: {},
        updatedAt: at("2026-01-01T00:00:00Z"),
        access: "all",
        organizations: [],
        workspaces: [],
      },
    ] as never);

    const connections = await listMcpConnections(USER_ID, { isDashboardViewer: false });

    // client-b's grant changed last, so it sorts first even though its consent is older.
    expect(connections.map(({ clientId, updatedAt }) => [clientId, updatedAt])).toEqual([
      ["client-b", at("2026-01-09T00:00:00Z")],
      ["client-a", at("2026-01-05T00:00:00Z")],
    ]);
    expect(connections[0]).toMatchObject({
      permissions: { surveys: "read" },
      access: { access: "workspaces", workspaceIds: ["ws-1"] },
    });
    expect(connections[1].access).toEqual({ access: "all" });
  });

  test("caps a Dashboard viewer's connection at what a viewer may give", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ scopes: ["surveys:write", "dashboards:read"] }),
    ] as never);
    prisma.mcpGrant.findMany.mockResolvedValue([]);

    const viewer = await listMcpConnections(USER_ID, { isDashboardViewer: true });
    const member = await listMcpConnections(USER_ID, { isDashboardViewer: false });

    expect(viewer[0].cap).toEqual({ charts: "read", dashboards: "read" });
    expect(member[0].cap).toMatchObject({ surveys: "write", dashboards: "read" });
  });
});

describe("editMcpGrant", () => {
  const tx = { marker: "tx" };

  beforeEach(() => {
    vi.mocked(readConsentedScopes).mockReset().mockResolvedValue(["surveys:write"]);
    vi.mocked(hasMcpGrant).mockReset().mockResolvedValue(true);
    vi.mocked(saveMcpGrant).mockReset();
    vi.mocked(projectMcpGrants).mockReset().mockResolvedValue(undefined);
    vi.mocked(listMcpGrantAccessOptions)
      .mockReset()
      .mockResolvedValue({
        organizations: [{ id: "org-1", name: "Org 1" }],
        workspaces: [{ id: "ws-1", name: "WS 1", organizationId: "org-1", organizationName: "Org 1" }],
      });
    prisma.$transaction.mockImplementation((async (callback: (client: unknown) => unknown) =>
      callback(tx)) as never);
  });

  test("saves within the cap and projects the grant after the commit", async () => {
    const before = stored();
    const after = stored({ permissions: { surveys: "write" }, access: "workspaces", workspaceIds: ["ws-1"] });
    vi.mocked(saveMcpGrant).mockResolvedValue({ before, after });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: { surveys: "write" },
        access: { access: "workspaces", workspaceIds: ["ws-1"] },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "saved", before, after });
    expect(readConsentedScopes).toHaveBeenCalledWith(tx, USER_ID, CLIENT_ID);
    expect(saveMcpGrant).toHaveBeenCalledWith(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: { surveys: "write" },
      access: { access: "workspaces", workspaceIds: ["ws-1"] },
    });
    expect(projectMcpGrants).toHaveBeenCalledWith(["grant-1"]);
  });

  test("doesn't consult the picker for All access or an omitted access", async () => {
    vi.mocked(saveMcpGrant).mockResolvedValue({ before: stored(), after: stored() });

    await editMcpGrant({
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: {},
      access: { access: "all" },
      isDashboardViewer: false,
    });
    await editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false });

    expect(listMcpGrantAccessOptions).not.toHaveBeenCalled();
    expect(saveMcpGrant).toHaveBeenCalledTimes(2);
  });

  test.each<[string, TMcpGrantAccessSelection, "organizationIds" | "workspaceIds"]>([
    [
      "organizations",
      { access: "organizations", organizationIds: ["org-1", "org-other"] },
      "organizationIds",
    ],
    ["workspaces", { access: "workspaces", workspaceIds: ["ws-1", "ws-other"] }, "workspaceIds"],
  ])("refuses %s the picker wouldn't offer, before any write", async (_mode, access, field) => {
    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: {},
        access,
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "selection_unreachable", field });
    expect(listMcpGrantAccessOptions).toHaveBeenCalledWith(USER_ID);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("accepts organizations the picker offers", async () => {
    vi.mocked(saveMcpGrant).mockResolvedValue({ before: stored(), after: stored() });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: {},
        access: { access: "organizations", organizationIds: ["org-1"] },
        isDashboardViewer: false,
      })
    ).resolves.toMatchObject({ status: "saved" });
  });

  test("is not_found without a consent", async () => {
    vi.mocked(readConsentedScopes).mockResolvedValue(null);

    await expect(
      editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false })
    ).resolves.toEqual({ status: "not_found" });
    expect(saveMcpGrant).not.toHaveBeenCalled();
    expect(projectMcpGrants).not.toHaveBeenCalled();
  });

  test("is not_found for a consent without a grant", async () => {
    vi.mocked(hasMcpGrant).mockResolvedValue(false);

    await expect(
      editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false })
    ).resolves.toEqual({ status: "not_found" });
    expect(hasMcpGrant).toHaveBeenCalledWith(tx, { userId: USER_ID, clientId: CLIENT_ID });
    expect(saveMcpGrant).not.toHaveBeenCalled();
  });

  test("refuses permissions above the consented scopes", async () => {
    vi.mocked(readConsentedScopes).mockResolvedValue(["surveys:read"]);

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: { surveys: "write" },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "beyond_scopes" });
    expect(saveMcpGrant).not.toHaveBeenCalled();
  });

  test("refuses a Dashboard viewer what only a member could give", async () => {
    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: { surveys: "write" },
        isDashboardViewer: true,
      })
    ).resolves.toEqual({ status: "beyond_scopes" });
  });

  test("fails rather than recreating a grant that vanished under the lock", async () => {
    vi.mocked(saveMcpGrant).mockResolvedValue({ before: null, after: stored() });

    await expect(
      editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false })
    ).rejects.toThrow("MCP grant disappeared while its consent was locked");
    expect(projectMcpGrants).not.toHaveBeenCalled();
  });
});
