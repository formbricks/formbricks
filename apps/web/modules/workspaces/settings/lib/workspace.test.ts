import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { StorageErrorCode } from "@formbricks/storage";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ValidationError,
} from "@formbricks/types/errors";
import { TWorkspace } from "@formbricks/types/workspace";
import { reconcileFeedbackDirectoryRelationships } from "@/lib/authzed/feedback-directory";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { getWorkspaceLegacyStoragePrefixes } from "@/lib/workspace/service";
import { deleteFile, deleteWorkspaceFilesBestEffort } from "@/modules/storage/service";
import { createWorkspace, deleteWorkspace, deleteWorkspaceIfNotLast, updateWorkspace } from "./workspace";

vi.mock("server-only", () => ({}));

// `satisfies` (not a `: TWorkspace` annotation) keeps the literal type, whose required-and-null
// fields also satisfy the Prisma row shape that `prisma.workspace.update` mocks resolve to.
const baseWorkspace = {
  id: "p1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Workspace 1",
  appSetupCompleted: false,
  organizationId: "org1",
  legacyEnvironmentId: null,
  languages: [],
  recontactDays: 0,
  linkSurveyBranding: false,
  inAppSurveyBranding: false,
  config: { channel: null, industry: null },
  placement: "bottomRight",
  clickOutsideClose: false,
  overlay: "none",
  styling: { allowStyleOverwrite: true },
  logo: null,
  customHeadScripts: null,
} satisfies TWorkspace;

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    workspace: {
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    workspaceTeam: {
      createMany: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    feedbackDirectory: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
    feedbackDirectoryWorkspace: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// ENG-1922: createWorkspace's org-scope guard queries team.findMany({ select: { id: true } }).
// Model exactly that projection for the mock — a single localized assertion instead of scattered
// `any` casts, so the fixture can't silently drift from the query's shape.
const mockOrgTeams = (...ids: string[]) =>
  ids.map((id) => ({ id })) as unknown as Awaited<ReturnType<typeof prisma.team.findMany>>;

vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));
vi.mock("@/lib/authzed/feedback-directory", () => ({
  reconcileFeedbackDirectoryRelationships: vi.fn(),
}));

const expectNoFrdSideEffects = () => {
  expect(prisma.feedbackDirectory.upsert).not.toHaveBeenCalled();
  expect(prisma.feedbackDirectory.findFirst).not.toHaveBeenCalled();
  expect(prisma.feedbackDirectoryWorkspace.count).not.toHaveBeenCalled();
  expect(prisma.feedbackDirectoryWorkspace.create).not.toHaveBeenCalled();
};

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/storage/service", () => ({
  deleteWorkspaceFilesBestEffort: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspaceLegacyStoragePrefixes: vi.fn(),
}));

describe("workspace lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // createWorkspace runs its ownership check and both writes in one transaction. Hand the callback
    // the same prisma mock so assertions stay on `prisma.*` and a rollback surfaces as a throw.
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
    vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValue([]);
  });

  // ENG-2418: removing or replacing a logo was a database-only write, so the old object stayed in the
  // bucket forever. Every upload gets a unique `--fid--{uuid}` key, so exactly one row referenced it.
  describe("updateWorkspace logo cleanup", () => {
    const LOGO_PREFIX = "/storage/p1/public";
    const oldUrl = `${LOGO_PREFIX}/old--fid--111.png`;
    const newUrl = `${LOGO_PREFIX}/new--fid--222.png`;

    const loadedAt = new Date("2026-09-23T10:00:00.000Z");

    // updateWorkspace reads the stored logo through a locked `SELECT … FOR UPDATE`, so the fixture
    // models that row rather than a whole workspace — same reasoning as mockOrgTeams above.
    const withStoredLogo = (url: string | null, updatedAt: Date = loadedAt) => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ logo: url ? { url } : null, updatedAt }]);
    };
    const resolvesTo = (workspace: Partial<TWorkspace> & { logo?: { url: string } | null }) => {
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce({
        ...baseWorkspace,
        ...workspace,
      } as unknown as Awaited<ReturnType<typeof prisma.workspace.update>>);
    };

    // The organization's whitelabel decides whether an object under this workspace's prefix is
    // actually an organization asset; by default the org claims nothing.
    const orgClaims = (whitelabel: { logoUrl?: string | null; faviconUrl?: string | null } | null) => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({ whitelabel } as unknown as Awaited<
        ReturnType<typeof prisma.organization.findUnique>
      >);
    };

    beforeEach(() => {
      vi.mocked(getWorkspaceLegacyStoragePrefixes).mockResolvedValue(["p1"]);
      vi.mocked(deleteFile).mockResolvedValue({ ok: true, data: undefined });
      orgClaims(null);
    });

    test("deletes the old object when the logo is removed", async () => {
      withStoredLogo(oldUrl);
      resolvesTo({ logo: null });

      await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).toHaveBeenCalledWith("p1", "public", "old--fid--111.png");
    });

    test("deletes only the old object when the logo is replaced", async () => {
      withStoredLogo(oldUrl);
      resolvesTo({ logo: { url: newUrl } });

      await updateWorkspace("p1", { logo: { url: newUrl }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).toHaveBeenCalledTimes(1);
      expect(deleteFile).toHaveBeenCalledWith("p1", "public", "old--fid--111.png");
    });

    test("deletes nothing when the logo url is unchanged", async () => {
      withStoredLogo(oldUrl);
      resolvesTo({ logo: { url: oldUrl } });

      await updateWorkspace("p1", { logo: { url: oldUrl, bgColor: "#fff" }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).not.toHaveBeenCalled();
    });

    // The same object can be named by an absolute and a relative url, and with the file name
    // percent-encoded or not. A raw string compare reads that as a change and deletes the object
    // the row still points at.
    test("deletes nothing when the url is re-spelled but resolves to the same object", async () => {
      withStoredLogo(`${LOGO_PREFIX}/my%20logo--fid--1.png`);
      resolvesTo({ logo: { url: "https://app.formbricks.com/storage/p1/public/my logo--fid--1.png" } });

      await updateWorkspace("p1", {
        logo: { url: "https://app.formbricks.com/storage/p1/public/my logo--fid--1.png" },
        expectedUpdatedAt: loadedAt,
      });

      expect(deleteFile).not.toHaveBeenCalled();
    });

    // The comparison runs after the write has committed, so a url whose percent escapes cannot be
    // decoded must not throw — that would report a save that actually succeeded as failed.
    test("resolves the update when the stored url has a malformed percent escape", async () => {
      withStoredLogo(`${LOGO_PREFIX}/bad%zz.png`);
      resolvesTo({ logo: null });

      await expect(
        updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt })
      ).resolves.toBeDefined();

      expect(deleteFile).not.toHaveBeenCalled();
    });

    test("does not read or delete anything when the update carries no logo", async () => {
      resolvesTo({ name: "renamed" });

      await updateWorkspace("p1", { name: "renamed" });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(deleteFile).not.toHaveBeenCalled();
    });

    // Prisma treats `logo: undefined` as "leave the field alone". Trusting the input instead of what
    // was persisted would delete the object while the row still points at it.
    test("deletes nothing when Prisma ignores an undefined logo", async () => {
      withStoredLogo(oldUrl);
      resolvesTo({ logo: { url: oldUrl } });

      await updateWorkspace("p1", { logo: undefined, expectedUpdatedAt: loadedAt });

      expect(deleteFile).not.toHaveBeenCalled();
    });

    // ENG-2258 / ENG-1981: logo.url is caller-supplied and parseStorageFileUrl does not check the
    // origin, so an unguarded delete is a cross-tenant delete primitive.
    test("refuses to delete an object under a prefix the workspace does not own", async () => {
      withStoredLogo("/storage/other-workspace/public/victim--fid--999.png");
      resolvesTo({ logo: null });

      await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    // Owning the prefix does not make the object a logo. Response attachments live under `private/`,
    // so the cleanup refuses anything that is not a public key.
    test("refuses to delete a private object even inside the workspace", async () => {
      withStoredLogo("/storage/p1/private/response-attachment--fid--888.pdf");
      resolvesTo({ logo: null });

      await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    // Organization favicons and email logos upload to the same `{workspaceId}/public/` prefix, but
    // changing them needs `organization.manage` while this path needs only `workspace.manage`.
    test.each([
      ["email logo", "logoUrl"],
      ["favicon", "faviconUrl"],
    ])("refuses to delete the organization's %s", async (_label, field) => {
      const orgAssetUrl = `${LOGO_PREFIX}/org-asset--fid--777.png`;
      orgClaims({ [field]: orgAssetUrl });
      withStoredLogo(orgAssetUrl);
      resolvesTo({ logo: null });

      await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    // The organization stores an absolute url while the workspace logo holds the relative one; both
    // resolve to the same object, so a raw string compare would miss it.
    test("matches an organization asset across url forms", async () => {
      orgClaims({ logoUrl: "https://app.formbricks.com/storage/p1/public/shared%20asset--fid--888.png" });
      withStoredLogo(`${LOGO_PREFIX}/shared asset--fid--888.png`);
      resolvesTo({ logo: null });

      await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).not.toHaveBeenCalled();
    });

    // Two saves that both loaded logo A: the replace writes C and deletes A, then the stale save
    // restores A. Without a baseline the row ends up pointing at an object that no longer exists.
    describe("stale-save guard", () => {
      const changedAt = new Date("2026-09-23T10:05:00.000Z");

      test("rejects a save whose baseline is older than the stored row", async () => {
        withStoredLogo(newUrl, changedAt);

        await expect(
          updateWorkspace("p1", { logo: { url: oldUrl }, expectedUpdatedAt: loadedAt })
        ).rejects.toThrow(OperationNotAllowedError);

        expect(prisma.workspace.update).not.toHaveBeenCalled();
        expect(deleteFile).not.toHaveBeenCalled();
      });

      test("accepts a save whose baseline matches", async () => {
        withStoredLogo(oldUrl);
        resolvesTo({ logo: { url: newUrl } });

        await updateWorkspace("p1", { logo: { url: newUrl }, expectedUpdatedAt: loadedAt });

        expect(deleteFile).toHaveBeenCalledWith("p1", "public", "old--fid--111.png");
      });

      // An opt-in guard protects nobody who forgets it, so a logo-bearing update without a baseline
      // is refused outright rather than silently skipping the version check.
      test("refuses a logo update that carries no baseline", async () => {
        await expect(updateWorkspace("p1", { logo: { url: undefined } })).rejects.toThrow(ValidationError);

        expect(prisma.workspace.update).not.toHaveBeenCalled();
        expect(deleteFile).not.toHaveBeenCalled();
      });

      test("leaves updates without a logo free of the baseline requirement", async () => {
        resolvesTo({ name: "renamed" });

        await expect(updateWorkspace("p1", { name: "renamed" })).resolves.toBeDefined();
      });

      // createWorkspace shares the same input schema and spreads it into prisma.create, so the
      // baseline has to be stripped there too or it reaches Prisma as an unknown column.
      test("is stripped by createWorkspace too", async () => {
        vi.mocked(prisma.workspace.create).mockResolvedValueOnce(baseWorkspace);

        await createWorkspace("org1", { name: "New", expectedUpdatedAt: loadedAt });

        expect(prisma.workspace.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.not.objectContaining({ expectedUpdatedAt: expect.anything() }),
          })
        );
      });

      test("never writes the baseline as a column", async () => {
        withStoredLogo(oldUrl);
        resolvesTo({ logo: null });

        await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

        expect(prisma.workspace.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.not.objectContaining({ expectedUpdatedAt: expect.anything() }),
          })
        );
      });
    });

    test("deletes an object under the workspace's legacy environment prefix", async () => {
      vi.mocked(getWorkspaceLegacyStoragePrefixes).mockResolvedValue(["p1", "env-legacy"]);
      withStoredLogo("/storage/env-legacy/public/legacy--fid--333.png");
      resolvesTo({ logo: null });

      await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).toHaveBeenCalledWith("env-legacy", "public", "legacy--fid--333.png");
    });

    test("leaves an external logo url alone", async () => {
      withStoredLogo("https://cdn.example.com/logo.png");
      resolvesTo({ logo: null });

      await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).not.toHaveBeenCalled();
    });

    // The url carries the percent-encoded name; the object is stored under the decoded one.
    test("decodes the file name before deleting", async () => {
      withStoredLogo(`${LOGO_PREFIX}/my%20logo--fid--444.png`);
      resolvesTo({ logo: null });

      await updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt });

      expect(deleteFile).toHaveBeenCalledWith("p1", "public", "my logo--fid--444.png");
    });

    test.each([
      [
        "returns an error",
        () =>
          vi.mocked(deleteFile).mockResolvedValue({ ok: false, error: { code: StorageErrorCode.Unknown } }),
      ],
      ["rejects", () => vi.mocked(deleteFile).mockRejectedValue(new Error("bucket down"))],
    ])("still resolves the update when deleteFile %s", async (_label, arrange) => {
      arrange();
      withStoredLogo(oldUrl);
      resolvesTo({ logo: null });

      await expect(
        updateWorkspace("p1", { logo: { url: undefined }, expectedUpdatedAt: loadedAt })
      ).resolves.toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("updateWorkspace", () => {
    test("updates workspace and revalidates cache", async () => {
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce(baseWorkspace);
      const result = await updateWorkspace("p1", {
        name: "Workspace 1",
      });
      expect(result).toEqual(baseWorkspace);
      expect(prisma.workspace.update).toHaveBeenCalled();
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({ workspaceIds: ["p1"] });
    });

    test("throws DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.workspace.update).mockRejectedValueOnce(
        new (class extends Error {
          constructor() {
            super();
            this.message = "fail";
          }
        })()
      );
      await expect(updateWorkspace("p1", { name: "Workspace 1" })).rejects.toThrow();
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2010",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.update).mockRejectedValueOnce(prismaError);
      await expect(updateWorkspace("p1", { name: "Workspace 1" })).rejects.toThrow(DatabaseError);
    });

    test("rethrows non-Prisma errors", async () => {
      vi.mocked(prisma.workspace.update).mockRejectedValueOnce(new Error("boom"));
      await expect(updateWorkspace("p1", { name: "Workspace 1" })).rejects.toThrow("boom");
    });

    test("returns workspace data without Zod validation", async () => {
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce({ ...baseWorkspace, id: 123 } as any);
      const result = await updateWorkspace("p1", { name: "Workspace 1" });
      expect(result).toEqual({ ...baseWorkspace, id: 123 });
    });

    // ENG-1919: a workspace must not be moved to another organization via update.
    test("never persists a caller-supplied organizationId", async () => {
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce(baseWorkspace);
      await updateWorkspace("p1", { name: "Workspace 1", organizationId: "attacker-target-org" });
      const arg = vi.mocked(prisma.workspace.update).mock.calls[0][0];
      expect(arg.data).not.toHaveProperty("organizationId");
    });
  });

  describe("createWorkspace", () => {
    test("creates workspace with team links and no FRD side-effects", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p2" };
      vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockOrgTeams("t1"));
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);
      vi.mocked(prisma.workspaceTeam.createMany).mockResolvedValueOnce({} as any);

      const result = await createWorkspace("org1", { name: "Workspace 1", teamIds: ["t1"] });

      expect(result).toEqual(createdWorkspace);
      // ENG-1922: teamIds must be validated against the target org before linking.
      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["t1"] }, organizationId: "org1" } })
      );
      expect(prisma.workspace.create).toHaveBeenCalled();
      expect(prisma.workspaceTeam.createMany).toHaveBeenCalled();
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
        workspaceIds: ["p2"],
        workspaceTeamGrants: [{ teamId: "t1", workspaceId: "p2" }],
      });
      expectNoFrdSideEffects();
    });

    // ENG-1922: a caller must not link a team from another organization to their workspace.
    test("rejects teamIds that belong to another organization", async () => {
      // Foreign team: the org-scoped lookup returns nothing.
      vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockOrgTeams());

      await expect(
        createWorkspace("org1", { name: "Workspace 1", teamIds: ["foreign-team"] })
      ).rejects.toThrow(ValidationError);

      // The membership check must run org-scoped...
      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["foreign-team"] }, organizationId: "org1" } })
      );
      // ...and the workspace and the join rows must never be written.
      expect(prisma.workspace.create).not.toHaveBeenCalled();
      expect(prisma.workspaceTeam.createMany).not.toHaveBeenCalled();
      // The rejection is logged for security observability, naming only tenant ids (no PII).
      expect(logger.warn).toHaveBeenCalledWith(
        { organizationId: "org1", foreignTeamIds: ["foreign-team"] },
        expect.stringContaining("Rejected cross-organization team assignment")
      );
    });

    // ENG-1922: the rejection log must not fire when every team is in the caller's organization.
    test("does not log a cross-organization warning on the happy path", async () => {
      vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockOrgTeams("t1"));
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce({ ...baseWorkspace, id: "p3" } as any);
      vi.mocked(prisma.workspaceTeam.createMany).mockResolvedValueOnce({} as any);

      await createWorkspace("org1", { name: "Workspace 1", teamIds: ["t1"] });

      expect(logger.warn).not.toHaveBeenCalled();
    });

    // ENG-1922: a mix of own-org and foreign teamIds must be rejected wholesale (count mismatch),
    // not partially linked.
    test("rejects when only some teamIds belong to the organization", async () => {
      // Only t1 is in the org; the org-scoped lookup omits the foreign id.
      vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockOrgTeams("t1"));

      await expect(
        createWorkspace("org1", { name: "Workspace 1", teamIds: ["t1", "foreign-team"] })
      ).rejects.toThrow(ValidationError);

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["t1", "foreign-team"] }, organizationId: "org1" } })
      );
      expect(prisma.workspace.create).not.toHaveBeenCalled();
      expect(prisma.workspaceTeam.createMany).not.toHaveBeenCalled();
    });

    test("rejects duplicate teamIds", async () => {
      await expect(createWorkspace("org1", { name: "Workspace 1", teamIds: ["t1", "t1"] })).rejects.toThrow(
        ValidationError
      );

      // Rejected before any lookup or write.
      expect(prisma.team.findMany).not.toHaveBeenCalled();
      expect(prisma.workspace.create).not.toHaveBeenCalled();
      expect(prisma.workspaceTeam.createMany).not.toHaveBeenCalled();
    });

    test("seeds English as the default survey language when creating a workspace", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p-language" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);

      await createWorkspace("org1", { name: "Workspace language" });

      const createArgs = vi.mocked(prisma.workspace.create).mock.calls[0][0];
      expect((createArgs.data as any).languages.create).toEqual([{ code: "en-US", alias: null }]);
    });

    test("seeds the default contact attribute keys when creating a workspace", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p-defaults" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);

      await createWorkspace("org1", { name: "Workspace defaults" });

      const createArgs = vi.mocked(prisma.workspace.create).mock.calls[0][0];
      const attributeCreate = (createArgs.data as any).contactAttributeKeys.create as Array<{
        key: string;
        type: string;
        isUnique?: boolean;
      }>;
      expect(attributeCreate.map((a) => a.key).sort()).toEqual(
        ["email", "firstName", "language", "lastName", "userId"].sort()
      );
      expect(attributeCreate.every((a) => a.type === "default")).toBe(true);
      const uniqueKeys = attributeCreate.filter((a) => a.isUnique).map((a) => a.key);
      expect(uniqueKeys.sort()).toEqual(["email", "userId"].sort());
    });

    test("creates workspace without teams and does not auto-link any FRD", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p3" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);

      const result = await createWorkspace("org1", { name: "Workspace No Teams" });

      expect(result).toEqual(createdWorkspace);
      expect(prisma.workspaceTeam.createMany).not.toHaveBeenCalled();
      expectNoFrdSideEffects();
    });

    test("does not upsert a Default Feedback Directory under any flow", async () => {
      const createdWorkspace = { ...baseWorkspace, id: "p4" };
      vi.mocked(prisma.workspace.create).mockResolvedValueOnce(createdWorkspace as any);

      await createWorkspace("org1", { name: "Second Workspace" });

      expect(prisma.feedbackDirectory.upsert).not.toHaveBeenCalled();
      expect(prisma.feedbackDirectoryWorkspace.create).not.toHaveBeenCalled();
    });

    test("throws ValidationError if name is missing", async () => {
      await expect(createWorkspace("org1", {})).rejects.toThrow(ValidationError);
    });

    test("throws InvalidInputError on unique constraint", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.create).mockRejectedValueOnce(prismaError);
      await expect(createWorkspace("org1", { name: "Workspace 1" })).rejects.toThrow(InvalidInputError);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.create).mockRejectedValueOnce(prismaError);
      await expect(createWorkspace("org1", { name: "Workspace 1" })).rejects.toThrow(DatabaseError);
    });

    test("throws unknown error", async () => {
      vi.mocked(prisma.workspace.create).mockRejectedValueOnce(new Error("fail"));
      await expect(createWorkspace("org1", { name: "Workspace 1" })).rejects.toThrow("fail");
    });
  });

  describe("deleteWorkspace", () => {
    test("deletes workspace, deletes files, and revalidates cache", async () => {
      const feedbackDirectoryAssignment = {
        feedbackDirectoryId: "feedback-directory-1",
        workspaceId: "p1",
      };
      vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValueOnce([
        feedbackDirectoryAssignment,
      ] as any);
      vi.mocked(prisma.workspace.delete).mockResolvedValueOnce(baseWorkspace as any);

      const result = await deleteWorkspace("p1");
      expect(result).toEqual(baseWorkspace);
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({ workspaceIds: ["p1"] });
      expect(reconcileFeedbackDirectoryRelationships).toHaveBeenCalledWith({
        assignments: [feedbackDirectoryAssignment],
      });
      expect(deleteWorkspaceFilesBestEffort).toHaveBeenCalledWith(baseWorkspace);
    });

    // ENG-3197: this used to pass a hardcoded [] for the legacy prefixes, so files uploaded before
    // the workspace was migrated off its environment id survived the delete.
    test("passes the workspace's legacy environment prefix to storage cleanup", async () => {
      const migratedWorkspace = { ...baseWorkspace, legacyEnvironmentId: "env-1" };
      vi.mocked(prisma.workspace.delete).mockResolvedValueOnce(migratedWorkspace as any);

      await deleteWorkspace("p1");

      expect(deleteWorkspaceFilesBestEffort).toHaveBeenCalledWith(migratedWorkspace);
    });

    test("selects legacyEnvironmentId off the deleted row", async () => {
      vi.mocked(prisma.workspace.delete).mockResolvedValueOnce(baseWorkspace as any);

      await deleteWorkspace("p1");

      expect(prisma.workspace.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ legacyEnvironmentId: true }),
        })
      );
    });

    test("throws DatabaseError on Prisma error", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.delete).mockRejectedValueOnce(err as any);
      await expect(deleteWorkspace("p1")).rejects.toThrow(DatabaseError);
    });

    test("throws unknown error", async () => {
      vi.mocked(prisma.workspace.delete).mockRejectedValueOnce(new Error("fail"));
      await expect(deleteWorkspace("p1")).rejects.toThrow("fail");
    });

    test("deletes a workspace while another workspace remains", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }]);
      vi.mocked(prisma.workspace.delete).mockResolvedValueOnce(baseWorkspace as any);

      await expect(deleteWorkspaceIfNotLast("p1", "org1")).resolves.toEqual(baseWorkspace);
    });

    test("does not delete the last workspace", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: "p1" }]);

      await expect(deleteWorkspaceIfNotLast("p1", "org1")).rejects.toThrow(OperationNotAllowedError);
      expect(prisma.workspace.delete).not.toHaveBeenCalled();
    });
  });
});
