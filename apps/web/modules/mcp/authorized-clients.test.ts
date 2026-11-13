import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readConsentedScopes } from "@/modules/auth/lib/oauth-grant-revocation";
import { editMcpGrant, listAuthorizedMcpClients } from "./authorized-clients";
import type { TMcpGrantAccessOptions } from "./grant-access";
import {
  type TStoredMcpGrant,
  lockMcpGrant,
  narrowMcpGrantAccess,
  projectMcpGrants,
  writeMcpGrant,
} from "./grant-store";

vi.mock("@/modules/auth/lib/oauth-grant-revocation", () => ({ readConsentedScopes: vi.fn() }));
vi.mock("./grant-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./grant-store")>()),
  lockMcpGrant: vi.fn(),
  narrowMcpGrantAccess: vi.fn(),
  projectMcpGrants: vi.fn(),
  writeMcpGrant: vi.fn(),
}));

const USER_ID = "user-1";
const CLIENT_ID = "client-1";

const at = (iso: string): Date => new Date(iso);

const CLIENT = {
  name: "Client",
  uri: "https://client.example",
  scopes: ["surveys:write"],
  skipConsent: false,
};

const consent = (
  overrides: Partial<{ id: string; clientId: string; scopes: string[]; createdAt: Date; updatedAt: Date }>
) => ({
  id: "consent-1",
  clientId: CLIENT_ID,
  scopes: ["surveys:write"],
  createdAt: at("2026-01-01T00:00:00Z"),
  updatedAt: at("2026-01-02T00:00:00Z"),
  client: CLIENT,
  ...overrides,
});

const grantRow = (
  overrides: Partial<{
    clientId: string;
    permissions: unknown;
    updatedAt: Date;
    access: "all" | "organizations" | "workspaces";
    organizations: string[];
    workspaces: string[];
  }> = {}
) => ({
  clientId: overrides.clientId ?? CLIENT_ID,
  permissions: overrides.permissions ?? { surveys: "read" },
  createdAt: at("2026-01-01T00:00:00Z"),
  updatedAt: overrides.updatedAt ?? at("2026-01-01T00:00:00Z"),
  access: overrides.access ?? "all",
  organizations: (overrides.organizations ?? []).map((organizationId) => ({ organizationId })),
  workspaces: (overrides.workspaces ?? []).map((workspaceId) => ({ workspaceId })),
});

const OPTIONS: TMcpGrantAccessOptions = {
  organizations: [{ id: "org-1", name: "Org 1" }],
  workspaces: [{ id: "ws-1", name: "WS 1", organizationId: "org-1", organizationName: "Org 1" }],
};

const list = (isDashboardViewer = false) =>
  listAuthorizedMcpClients(USER_ID, { isDashboardViewer, accessOptions: OPTIONS });

const stored = (overrides: Partial<TStoredMcpGrant> = {}): TStoredMcpGrant =>
  ({
    id: "grant-1",
    userId: USER_ID,
    clientId: CLIENT_ID,
    permissions: { surveys: "read" },
    access: "all",
    ...overrides,
  }) as TStoredMcpGrant;

/** The grants of consented clients first, then those of `skipConsent` clients without a consent. */
const grants = (consented: unknown[], skipConsent: unknown[] = []) => {
  prisma.mcpGrant.findMany.mockImplementation((async (args: { where: { client?: unknown } }) =>
    args.where.client ? skipConsent : consented) as never);
};

describe("listAuthorizedMcpClients", () => {
  beforeEach(() => {
    grants([]);
  });

  test("folds duplicate consents into one client, keeping the newest's scopes and the oldest's date", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ id: "consent-new", scopes: ["surveys:write"], createdAt: at("2026-03-01T00:00:00Z") }),
      consent({ id: "consent-old", scopes: ["surveys:read"], createdAt: at("2026-01-01T00:00:00Z") }),
      consent({ id: "consent-mid", scopes: ["surveys:read"], createdAt: at("2026-02-01T00:00:00Z") }),
    ] as never);

    const [client, ...rest] = await list();

    expect(rest).toHaveLength(0);
    expect(client).toMatchObject({
      clientId: CLIENT_ID,
      connectedAt: at("2026-01-01T00:00:00Z"),
      permissions: null,
      access: null,
      cap: { surveys: "write", creatives: "write", surveyStyling: "write" },
    });
    expect(prisma.oauthConsent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
  });

  test("reads only the grants of the listed clients, and of skipConsent clients, newest first", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ clientId: "client-a" }),
      consent({ id: "consent-b", clientId: "client-b" }),
    ] as never);

    await list();

    expect(prisma.mcpGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, clientId: { in: ["client-a", "client-b"] } } })
    );
    expect(prisma.mcpGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER_ID,
          clientId: { notIn: ["client-a", "client-b"] },
          client: { skipConsent: true },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 500,
      })
    );
  });

  test("reads no consented grants for a user with no consent", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([] as never);

    await expect(list()).resolves.toEqual([]);
    expect(prisma.mcpGrant.findMany).toHaveBeenCalledTimes(1);
  });

  test("shows the grant's permissions and access, with the later of the consent's and grant's change", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ clientId: "client-a", updatedAt: at("2026-01-05T00:00:00Z") }),
      consent({ id: "consent-b", clientId: "client-b", updatedAt: at("2026-01-04T00:00:00Z") }),
    ] as never);
    grants([
      grantRow({
        clientId: "client-b",
        permissions: { surveys: "read", bogus: "write" },
        updatedAt: at("2026-01-09T00:00:00Z"),
        access: "workspaces",
        organizations: ["org-stray"],
        workspaces: ["ws-1"],
      }),
      grantRow({ clientId: "client-a", permissions: {} }),
    ]);

    const clients = await list();

    // client-b's grant changed last, so it sorts first even though its consent is older.
    expect(clients.map(({ clientId, updatedAt }) => [clientId, updatedAt])).toEqual([
      ["client-b", at("2026-01-09T00:00:00Z")],
      ["client-a", at("2026-01-05T00:00:00Z")],
    ]);
    expect(clients[0]).toMatchObject({
      permissions: { surveys: "read" },
      access: { access: "workspaces", workspaceIds: ["ws-1"] },
    });
    expect(clients[1].access).toEqual({ access: "all" });
  });

  // Spec story 36: what the user lost isn't counted, nor opened in Edit.
  test("shows only the organizations and workspaces the picker still offers", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ clientId: "client-a" }),
      consent({ id: "consent-b", clientId: "client-b" }),
    ] as never);
    grants([
      grantRow({ clientId: "client-a", access: "workspaces", workspaces: ["ws-1", "ws-lost"] }),
      grantRow({
        clientId: "client-b",
        access: "organizations",
        organizations: ["org-billing-only", "org-1"],
      }),
    ]);

    const clients = await list();

    expect(clients.find(({ clientId }) => clientId === "client-a")?.access).toEqual({
      access: "workspaces",
      workspaceIds: ["ws-1"],
    });
    expect(clients.find(({ clientId }) => clientId === "client-b")?.access).toEqual({
      access: "organizations",
      organizationIds: ["org-1"],
    });
  });

  // Spec stories 29 and 38: a client authorized without the consent screen is listed like any other.
  test("lists a skipConsent client's grant, capped by the scopes the client is registered with", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ updatedAt: at("2026-01-02T00:00:00Z") }),
    ] as never);
    grants(
      [],
      [
        {
          ...grantRow({ clientId: "first-party", permissions: { surveys: "read" } }),
          updatedAt: at("2026-02-01T00:00:00Z"),
          client: { name: "First party", uri: null, scopes: ["surveys:read"], skipConsent: true },
        },
      ]
    );

    const clients = await list();

    expect(clients[0]).toEqual({
      clientId: "first-party",
      clientName: "First party",
      clientUri: null,
      connectedAt: at("2026-01-01T00:00:00Z"),
      updatedAt: at("2026-02-01T00:00:00Z"),
      permissions: { surveys: "read" },
      access: { access: "all" },
      cap: { surveys: "read", creatives: "read", surveyStyling: "read" },
    });
    expect(clients).toHaveLength(2);
  });

  test("caps a consented client that is skipConsent by its registered scopes", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({
        scopes: ["surveys:write"],
        client: { ...CLIENT, scopes: ["surveys:read"], skipConsent: true },
      } as never),
    ] as never);

    const [client] = await list();

    expect(client.cap).toEqual({ surveys: "read", creatives: "read", surveyStyling: "read" });
  });

  test("caps a Dashboard viewer's client at what a viewer may give", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ scopes: ["surveys:write", "dashboards:read"] }),
    ] as never);

    const viewer = await list(true);
    const member = await list(false);

    expect(viewer[0].cap).toEqual({ charts: "read", dashboards: "read" });
    expect(member[0].cap).toMatchObject({ surveys: "write", dashboards: "read" });
  });
});

describe("editMcpGrant", () => {
  const tx = { oauthClient: { findUnique: vi.fn() } };

  beforeEach(() => {
    vi.mocked(readConsentedScopes).mockReset().mockResolvedValue(["surveys:write"]);
    vi.mocked(lockMcpGrant).mockReset().mockResolvedValue(stored());
    vi.mocked(narrowMcpGrantAccess).mockReset();
    vi.mocked(writeMcpGrant).mockReset();
    vi.mocked(projectMcpGrants).mockReset().mockResolvedValue(undefined);
    tx.oauthClient.findUnique.mockReset().mockResolvedValue({ scopes: ["surveys:read"], skipConsent: false });
    prisma.$transaction.mockImplementation((async (callback: (client: unknown) => unknown) =>
      callback(tx)) as never);
  });

  test("locks the grant, narrows the access, saves within the cap and projects after the commit", async () => {
    const before = stored({ access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] });
    const after = stored({ permissions: { surveys: "write" }, access: "workspaces", workspaceIds: ["ws-1"] });
    vi.mocked(lockMcpGrant).mockResolvedValue(before);
    vi.mocked(narrowMcpGrantAccess).mockResolvedValue({
      status: "ok",
      access: { access: "workspaces", workspaceIds: ["ws-1"] },
    });
    vi.mocked(writeMcpGrant).mockResolvedValue({ before, after });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: { surveys: "write" },
        access: { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "saved", before, after });
    expect(lockMcpGrant).toHaveBeenCalledWith(tx, { userId: USER_ID, clientId: CLIENT_ID });
    expect(readConsentedScopes).toHaveBeenCalledWith(tx, USER_ID, CLIENT_ID);
    expect(narrowMcpGrantAccess).toHaveBeenCalledWith(tx, {
      userId: USER_ID,
      before,
      access: { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] },
    });
    // The resolved access is saved, without what the user lost.
    expect(writeMcpGrant).toHaveBeenCalledWith(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      before,
      permissions: { surveys: "write" },
      access: { access: "workspaces", workspaceIds: ["ws-1"] },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 15_000 });
    expect(projectMcpGrants).toHaveBeenCalledWith(["grant-1"]);
  });

  test("keeps the grant's access when the edit names none, without resolving anything", async () => {
    vi.mocked(writeMcpGrant).mockResolvedValue({ before: stored(), after: stored() });

    await editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false });

    expect(narrowMcpGrantAccess).not.toHaveBeenCalled();
    expect(writeMcpGrant).toHaveBeenCalledWith(tx, expect.objectContaining({ access: undefined }));
  });

  test("refuses an organization or workspace the user can't select, and writes nothing", async () => {
    vi.mocked(narrowMcpGrantAccess).mockResolvedValue({ status: "unavailable", field: "workspaceIds" });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: {},
        access: { access: "workspaces", workspaceIds: ["ws-foreign"] },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "selection_unavailable", field: "workspaceIds" });
    expect(writeMcpGrant).not.toHaveBeenCalled();
    expect(projectMcpGrants).not.toHaveBeenCalled();
  });

  test("is not_found without a grant, before reading the consent", async () => {
    vi.mocked(lockMcpGrant).mockResolvedValue(null);

    await expect(
      editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false })
    ).resolves.toEqual({ status: "not_found" });
    expect(readConsentedScopes).not.toHaveBeenCalled();
    expect(writeMcpGrant).not.toHaveBeenCalled();
  });

  test("is not_found for a grant whose consent is gone, or whose client is gone", async () => {
    vi.mocked(readConsentedScopes).mockResolvedValue(null);
    await expect(
      editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false })
    ).resolves.toEqual({ status: "not_found" });

    tx.oauthClient.findUnique.mockResolvedValue(null);
    await expect(
      editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false })
    ).resolves.toEqual({ status: "not_found" });
    expect(writeMcpGrant).not.toHaveBeenCalled();
  });

  test("caps a skipConsent client's grant by its registered scopes, without a consent", async () => {
    tx.oauthClient.findUnique.mockResolvedValue({ scopes: ["surveys:read"], skipConsent: true });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: { surveys: "write" },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "beyond_scopes" });
    expect(readConsentedScopes).not.toHaveBeenCalled();
  });

  test("refuses permissions above the consented scopes, before touching SpiceDB", async () => {
    vi.mocked(readConsentedScopes).mockResolvedValue(["surveys:read"]);

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: { surveys: "write" },
        access: { access: "all" },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "beyond_scopes" });
    expect(narrowMcpGrantAccess).not.toHaveBeenCalled();
    expect(writeMcpGrant).not.toHaveBeenCalled();
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

  test("reconciles the grant and rethrows when the save fails after the narrowing", async () => {
    vi.mocked(narrowMcpGrantAccess).mockResolvedValue({ status: "ok", access: { access: "all" } });
    const failure = new Error("commit failed");
    vi.mocked(writeMcpGrant).mockRejectedValue(failure);

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: {},
        access: { access: "all" },
        isDashboardViewer: false,
      })
    ).rejects.toBe(failure);
    expect(projectMcpGrants).toHaveBeenCalledWith(["grant-1"]);
  });

  test("rethrows a failure before any grant was locked without reconciling", async () => {
    const failure = new Error("pool exhausted");
    vi.mocked(lockMcpGrant).mockRejectedValue(failure);

    await expect(
      editMcpGrant({ userId: USER_ID, clientId: CLIENT_ID, permissions: {}, isDashboardViewer: false })
    ).rejects.toBe(failure);
    expect(projectMcpGrants).not.toHaveBeenCalled();
  });
});
