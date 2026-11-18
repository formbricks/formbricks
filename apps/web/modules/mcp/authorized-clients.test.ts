import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readConsentedScopes } from "@/modules/auth/lib/oauth-consent-rows";
import { readMcpGrantReadableWorkspaceIds } from "./access-options";
import { editMcpGrant, listAuthorizedMcpClients } from "./authorized-clients";
import type { TMcpGrantAccessOptions } from "./grant-access";
import { prepareMcpGrantAudits } from "./grant-audit";
import {
  type TStoredMcpGrant,
  lockMcpGrant,
  narrowMcpGrantAccess,
  projectMcpGrants,
  repairMcpGrantsAfterFailedSave,
  writeMcpGrant,
} from "./grant-store";

vi.mock("@/modules/auth/lib/oauth-consent-rows", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/auth/lib/oauth-consent-rows")>()),
  readConsentedScopes: vi.fn(),
}));
vi.mock("./access-options", () => ({ readMcpGrantReadableWorkspaceIds: vi.fn() }));
// Tested in `grant-store.test.ts`: here, the entries name what they were prepared from.
vi.mock("./grant-audit", () => ({
  prepareMcpGrantAudits: vi.fn(async (_tx: unknown, changes: unknown[]) =>
    changes.map((change) => ({ ...(change as object), organizationIds: [] }))
  ),
}));
vi.mock("./grant-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./grant-store")>()),
  lockMcpGrant: vi.fn(),
  narrowMcpGrantAccess: vi.fn(),
  projectMcpGrants: vi.fn(),
  repairMcpGrantsAfterFailedSave: vi.fn(),
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

/** The grants of consented clients first, then those of clients without a consent. */
const grants = (consented: unknown[], unconsented: unknown[] = []) => {
  prisma.mcpGrant.findMany.mockImplementation((async (args: { where: { clientId: object } }) =>
    "notIn" in args.where.clientId ? unconsented : consented) as never);
};

describe("listAuthorizedMcpClients", () => {
  beforeEach(() => {
    grants([]);
  });

  test("folds duplicate consents into one client, keeping the newest's scopes and the oldest's date", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({
        id: "consent-new",
        scopes: ["surveys:write"],
        createdAt: at("2026-03-01T00:00:00Z"),
        updatedAt: at("2026-03-02T00:00:00Z"),
      }),
      consent({
        id: "consent-mid",
        scopes: ["surveys:read"],
        createdAt: at("2026-02-01T00:00:00Z"),
        updatedAt: at("2026-02-02T00:00:00Z"),
      }),
      consent({ id: "consent-old", scopes: ["surveys:read"], createdAt: at("2026-01-01T00:00:00Z") }),
    ] as never);

    const [client, ...rest] = await list();

    expect(rest).toHaveLength(0);
    expect(client).toMatchObject({
      clientId: CLIENT_ID,
      connectedAt: at("2026-01-01T00:00:00Z"),
      permissions: null,
      access: null,
      grantUpdatedAt: null,
      cap: { surveys: "write", creatives: "write", surveyStyling: "write" },
    });
    expect(prisma.oauthConsent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
  });

  // Two rows written in the same second can't be ordered: Save holds the grant to what both allow
  // (`consentBound`), so the cap Edit offers is the same, never Write that Save then refuses.
  test("caps a client whose newest consents tie at what every tied row allows, as a save does", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([
      consent({ id: "consent-b", scopes: ["surveys:write", "responses:read"] }),
      consent({ id: "consent-a", scopes: ["responses:read"] }),
      consent({ id: "consent-old", scopes: ["surveys:write"], updatedAt: at("2026-01-01T00:00:00Z") }),
    ] as never);

    const [client] = await list();

    // Not Surveys: Write, which only the row with the higher id allows.
    expect(client.cap).toEqual({ responses: "read", tags: "read" });
  });

  test("reads the grants of the listed clients, and every other grant of the user, newest first", async () => {
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
        where: { userId: USER_ID, clientId: { notIn: ["client-a", "client-b"] } },
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
      // The grant's own version, which Edit sends back with its save, not the later of the two dates.
      grantUpdatedAt: at("2026-01-09T00:00:00Z"),
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
      grantUpdatedAt: at("2026-02-01T00:00:00Z"),
    });
    expect(clients).toHaveLength(2);
  });

  // A client switched off `skipConsent` after it was authorized keeps its grant and has no consent: it
  // has to be listed, or Revoke can't reach it. Nothing caps it but a new approval, so Edit gives nothing.
  test("lists a grant whose client has neither a consent nor skipConsent, capped at nothing", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([] as never);
    grants(
      [],
      [
        {
          ...grantRow({ clientId: "was-first-party", permissions: { surveys: "read" } }),
          client: { name: "Was first party", uri: null, scopes: ["surveys:read"], skipConsent: false },
        },
      ]
    );

    const clients = await list();

    expect(clients).toEqual([
      {
        clientId: "was-first-party",
        clientName: "Was first party",
        clientUri: null,
        connectedAt: at("2026-01-01T00:00:00Z"),
        updatedAt: at("2026-01-01T00:00:00Z"),
        permissions: { surveys: "read" },
        access: { access: "all" },
        cap: {},
        grantUpdatedAt: at("2026-01-01T00:00:00Z"),
      },
    ]);
  });

  // More consents than the list shows: the capped read leaves a client's consent out while its grant is
  // among the user's other grants. Its cap is still its consent's, not nothing.
  test("caps a grant whose consent the capped read left out by that consent", async () => {
    const listed = Array.from({ length: 500 }, (_unused, index) =>
      consent({ id: `consent-${index.toString()}`, clientId: `client-${index.toString()}` })
    );
    prisma.oauthConsent.findMany.mockResolvedValueOnce(listed as never);
    // Every row tied at each client's newest, chosen in the database: duplicates of another second cost none.
    prisma.$queryRaw.mockResolvedValue([
      { clientId: "client-omitted", scopes: ["surveys:write"], updatedAt: at("2026-05-01T00:00:00Z") },
      {
        clientId: "client-omitted",
        scopes: ["surveys:write", "responses:read"],
        updatedAt: at("2026-05-01T00:00:00Z"),
      },
    ] as never);
    grants(
      [],
      [
        {
          ...grantRow({ clientId: "client-omitted", updatedAt: at("2026-06-01T00:00:00Z") }),
          client: CLIENT,
        },
      ]
    );

    const clients = await list();

    expect(clients.find(({ clientId }) => clientId === "client-omitted")?.cap).toEqual({
      surveys: "write",
      creatives: "write",
      surveyStyling: "write",
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    // Bound by the clients the grants name, not by every consent the user has.
    const [, queryUserId, boundClientIds] = prisma.$queryRaw.mock.calls[0] as unknown[];
    expect(queryUserId).toBe(USER_ID);
    expect(JSON.stringify(boundClientIds)).toContain("client-omitted");
    expect(prisma.oauthConsent.findMany).toHaveBeenCalledTimes(1);
  });

  test("reads no further consents below the cap", async () => {
    prisma.oauthConsent.findMany.mockResolvedValue([consent({})] as never);
    grants([], [{ ...grantRow({ clientId: "other" }), client: CLIENT }]);

    await list();

    expect(prisma.oauthConsent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
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
  const OPENED_AT = at("2026-06-01T10:00:00.123Z");
  const tx = { oauthClient: { findUnique: vi.fn() }, mcpGrant: { findUniqueOrThrow: vi.fn() } };
  const steps: string[] = [];

  beforeEach(() => {
    vi.mocked(readConsentedScopes).mockReset().mockResolvedValue(["surveys:write"]);
    vi.mocked(lockMcpGrant).mockReset().mockResolvedValue(stored());
    vi.mocked(narrowMcpGrantAccess).mockReset();
    vi.mocked(writeMcpGrant).mockReset();
    vi.mocked(projectMcpGrants).mockReset().mockResolvedValue(undefined);
    vi.mocked(readMcpGrantReadableWorkspaceIds)
      .mockReset()
      .mockResolvedValue(new Set(["ws-1"]));
    tx.oauthClient.findUnique.mockReset().mockResolvedValue({ scopes: ["surveys:read"], skipConsent: false });
    tx.mcpGrant.findUniqueOrThrow.mockReset().mockResolvedValue({ updatedAt: OPENED_AT });
    // The callback, then the commit, as a step of its own: what runs after it ran after the commit.
    steps.length = 0;
    prisma.$transaction.mockImplementation((async (callback: (client: unknown) => unknown) => {
      const result = await callback(tx);
      steps.push("commit");
      return result;
    }) as never);
  });

  // Another tab or session saved the grant after Edit opened it: this save would undo that change unseen.
  test("is changed, and writes nothing, when the grant was saved since Edit opened it", async () => {
    const savedSince = at("2026-06-01T10:00:00.124Z");
    tx.mcpGrant.findUniqueOrThrow.mockResolvedValue({ updatedAt: savedSince });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: {
          permissions: { surveys: "read" },
          access: { access: "workspaces", workspaceIds: ["ws-1"] },
        },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "changed", currentUpdatedAt: savedSince });
    expect(tx.mcpGrant.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "grant-1" },
      select: { updatedAt: true },
    });
    expect(readConsentedScopes).not.toHaveBeenCalled();
    expect(narrowMcpGrantAccess).not.toHaveBeenCalled();
    expect(writeMcpGrant).not.toHaveBeenCalled();
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
    vi.mocked(projectMcpGrants).mockImplementation(async () => {
      steps.push("project");
    });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: {
          permissions: { surveys: "write" },
          access: { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] },
        },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({
      status: "saved",
      before,
      after,
      audits: [{ action: "updated", before, after, organizationIds: [] }],
    });
    // Audited from what the transaction read, so the entries name the organizations as the edit left them.
    expect(prepareMcpGrantAudits).toHaveBeenCalledWith(tx, [{ action: "updated", before, after }]);
    expect(lockMcpGrant).toHaveBeenCalledWith(tx, { userId: USER_ID, clientId: CLIENT_ID });
    expect(readConsentedScopes).toHaveBeenCalledWith(tx, USER_ID, CLIENT_ID);
    expect(narrowMcpGrantAccess).toHaveBeenCalledWith(tx, {
      userId: USER_ID,
      before,
      access: { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] },
      readableWorkspaceIds: new Set(["ws-1"]),
    });
    // SpiceDB is asked which workspaces the user can read before the grant row is locked, never under it.
    expect(readMcpGrantReadableWorkspaceIds).toHaveBeenCalledWith(USER_ID, {
      access: "workspaces",
      workspaceIds: ["ws-1", "ws-lost"],
    });
    expect(vi.mocked(readMcpGrantReadableWorkspaceIds).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(prisma.$transaction).mock.invocationCallOrder[0]
    );
    // The resolved access is saved, without what the user lost.
    expect(writeMcpGrant).toHaveBeenCalledWith(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      before,
      permissions: { surveys: "write" },
      access: { access: "workspaces", workspaceIds: ["ws-1"] },
    });
    // The reconciler can hold the grant row for 30 s; the save allows for that, then 15 s of its own.
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 45_000 });
    expect(projectMcpGrants).toHaveBeenCalledWith(["grant-1"]);
    // What the edit adds reaches SpiceDB only once its rows are committed.
    expect(steps).toEqual(["commit", "project"]);
  });

  test("keeps the grant's access when the edit names none, without resolving anything", async () => {
    vi.mocked(writeMcpGrant).mockResolvedValue({ before: stored(), after: stored() });

    await editMcpGrant({
      userId: USER_ID,
      clientId: CLIENT_ID,
      expectedUpdatedAt: OPENED_AT,
      grant: { permissions: {} },
      isDashboardViewer: false,
    });

    expect(narrowMcpGrantAccess).not.toHaveBeenCalled();
    expect(writeMcpGrant).toHaveBeenCalledWith(tx, expect.objectContaining({ access: undefined }));
  });

  test("refuses an organization or workspace the user can't select, and writes nothing", async () => {
    vi.mocked(narrowMcpGrantAccess).mockResolvedValue({ status: "unavailable", field: "workspaceIds" });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: {}, access: { access: "workspaces", workspaceIds: ["ws-foreign"] } },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "selection_unavailable", field: "workspaceIds" });
    expect(writeMcpGrant).not.toHaveBeenCalled();
    expect(projectMcpGrants).not.toHaveBeenCalled();
  });

  test("is not_found without a grant, before reading the consent", async () => {
    vi.mocked(lockMcpGrant).mockResolvedValue(null);

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: {} },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "not_found" });
    expect(readConsentedScopes).not.toHaveBeenCalled();
    expect(writeMcpGrant).not.toHaveBeenCalled();
  });

  test("is not_found for a grant whose consent is gone, or whose client is gone", async () => {
    vi.mocked(readConsentedScopes).mockResolvedValue(null);
    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: {} },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "not_found" });

    tx.oauthClient.findUnique.mockResolvedValue(null);
    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: {} },
        isDashboardViewer: false,
      })
    ).resolves.toEqual({ status: "not_found" });
    expect(writeMcpGrant).not.toHaveBeenCalled();
  });

  test("caps a skipConsent client's grant by its registered scopes, without a consent", async () => {
    tx.oauthClient.findUnique.mockResolvedValue({ scopes: ["surveys:read"], skipConsent: true });

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: { surveys: "write" } },
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
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: { surveys: "write" }, access: { access: "all" } },
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
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: { surveys: "write" } },
        isDashboardViewer: true,
      })
    ).resolves.toEqual({ status: "beyond_scopes" });
  });

  test("repairs the grant durably and rethrows when the save fails after the narrowing", async () => {
    vi.mocked(narrowMcpGrantAccess).mockResolvedValue({ status: "ok", access: { access: "all" } });
    const failure = new Error("commit failed");
    vi.mocked(writeMcpGrant).mockRejectedValue(failure);

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: {}, access: { access: "all" } },
        isDashboardViewer: false,
      })
    ).rejects.toBe(failure);
    expect(repairMcpGrantsAfterFailedSave).toHaveBeenCalledWith(["grant-1"]);
  });

  test("rethrows a failure before any grant was locked without repairing", async () => {
    const failure = new Error("pool exhausted");
    vi.mocked(lockMcpGrant).mockRejectedValue(failure);

    await expect(
      editMcpGrant({
        userId: USER_ID,
        clientId: CLIENT_ID,
        expectedUpdatedAt: OPENED_AT,
        grant: { permissions: {} },
        isDashboardViewer: false,
      })
    ).rejects.toBe(failure);
    expect(repairMcpGrantsAfterFailedSave).not.toHaveBeenCalled();
    expect(projectMcpGrants).not.toHaveBeenCalled();
  });
});
