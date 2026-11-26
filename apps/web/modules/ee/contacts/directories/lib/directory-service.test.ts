import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT } from "./constants";
import {
  ContactDirectoryArchiveHasWorkspacesError,
  ContactDirectoryArchivedError,
  ContactDirectoryNameRequiredError,
  ContactDirectoryNameTakenError,
  ContactDirectoryNotFoundError,
  ContactDirectoryWorkspacesInOtherDirectoryError,
  ContactDirectoryWorkspacesNotFoundError,
} from "./directory-errors";
import {
  createContactDirectory,
  getContactDirectory,
  getContactDirectoryTargetedSurveys,
  getSharedContactDirectoryName,
  listContactDirectories,
  updateContactDirectory,
} from "./directory-service";

vi.mock("server-only", () => ({}));

/**
 * One fake client serves as both `prisma` and the transaction client. It holds a tiny organization in
 * memory and answers the service's queries from it, so the tests read as "given these directories, this
 * happens". `log` records the order of locks and writes. The real queries (the targeted-survey filter,
 * the trigger) are covered by `directory-service.integration.test.ts`.
 */
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  contactDirectory: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  contactAttributeKey: { createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  workspace: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  contact: { groupBy: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  segment: { findMany: vi.fn(), updateMany: vi.fn() },
  survey: { findMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@formbricks/database", () => ({ prisma: db }));

const ORG = "clorg000000000000000000000";
const OTHER_ORG = "clorg999999999999999999999";

type TWorkspaceRow = { id: string; name: string; organizationId: string; contactDirectoryId: string | null };
type TDirectoryRow = {
  id: string;
  organizationId: string;
  name: string;
  matchingKey: "email" | "userId";
  isArchived: boolean;
  contacts?: number;
};
/** `targeted`: whether the survey matches the targeted-survey filter (the real filter runs in Postgres). */
type TSurveyRow = { id: string; name: string; workspaceId: string; targeted: boolean; status: string };

let workspaces: TWorkspaceRow[];
let directories: TDirectoryRow[];
let surveys: TSurveyRow[];
let log: string[];

const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values as string[] };
};

const inIds = (where: unknown): string[] => (where as { in: string[] }).in;

const setup = ({
  ws,
  dirs,
  srv = [],
}: {
  ws: TWorkspaceRow[];
  dirs: TDirectoryRow[];
  srv?: TSurveyRow[];
}) => {
  workspaces = ws.map((w) => ({ ...w }));
  directories = dirs.map((d) => ({ ...d }));
  surveys = srv.map((s) => ({ ...s }));
  log = [];

  db.$transaction.mockImplementation(((fn: (client: typeof db) => unknown) => fn(db)) as never);

  db.$queryRaw.mockImplementation(async (...args: unknown[]) => {
    const { text, values } = statement(args);
    if (text.includes('FROM "Survey"')) {
      // The confirm step's capped list: the last value is the per-workspace limit.
      const workspaceIds = values.slice(0, -1);
      const limit = Number(values.at(-1));
      return workspaceIds.flatMap((workspaceId) => {
        const ofWorkspace = surveys
          .filter((s) => s.targeted && s.workspaceId === workspaceId)
          .sort((x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id));
        return ofWorkspace
          .slice(0, limit)
          .map(({ id, name, status }) => ({ id, name, workspaceId, status, totalCount: ofWorkspace.length }));
      });
    }
    const [organizationId, ...ids] = values;
    if (text.includes('FROM "Workspace"')) {
      log.push(`lock workspaces ${ids.join(",")}`);
      return workspaces
        .filter((w) => w.organizationId === organizationId && ids.includes(w.id))
        .map(({ id, contactDirectoryId }) => ({ id, contactDirectoryId }));
    }
    if (text.includes('FROM "ContactDirectory"')) {
      log.push(`lock directory ${ids.join(",")}`);
      return directories
        .filter((d) => d.organizationId === organizationId && ids.includes(d.id))
        .map(({ id, name, isArchived }) => ({ id, name, isArchived }));
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });

  const publicDirectory = ({ id, name, matchingKey, isArchived }: TDirectoryRow) => ({
    id,
    name,
    matchingKey,
    isArchived,
  });
  db.contactDirectory.findMany.mockImplementation(async ({ where }: { where: { organizationId: string } }) =>
    directories.filter((d) => d.organizationId === where.organizationId).map(publicDirectory)
  );
  db.contactDirectory.findFirst.mockImplementation(
    async ({ where }: { where: { id?: string; organizationId: string; name?: unknown } }) => {
      // The case-insensitive name check: no clash in these tests.
      if (where.name) return null;
      const found = directories.find((d) => d.id === where.id && d.organizationId === where.organizationId);
      return found ? publicDirectory(found) : null;
    }
  );
  db.contactDirectory.create.mockImplementation(
    async ({ data }: { data: Omit<TDirectoryRow, "id" | "isArchived"> }) => {
      log.push("create directory");
      const created = { id: "clnewdir00000000000000000", isArchived: false, ...data };
      directories.push(created);
      return { id: created.id };
    }
  );
  db.contactDirectory.update.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: { name: string; isArchived: boolean } }) => {
      log.push(`update directory ${where.id} ${JSON.stringify(data)}`);
      Object.assign(directories.find((d) => d.id === where.id)!, data);
      return { id: where.id };
    }
  );
  db.contactAttributeKey.createMany.mockResolvedValue({ count: 5 });
  // Rows a previous-release pod wrote for a workspace with no directory: none here (integration test).
  db.contactAttributeKey.findMany.mockResolvedValue([]);
  db.contactAttributeKey.updateMany.mockResolvedValue({ count: 0 });
  db.segment.findMany.mockResolvedValue([]);
  db.segment.updateMany.mockResolvedValue({ count: 0 });
  db.contact.updateMany.mockResolvedValue({ count: 0 });
  db.contact.findFirst.mockResolvedValue(null);
  db.contact.groupBy.mockImplementation(async ({ where }: { where: { directoryId: unknown } }) =>
    directories
      .filter((d) => inIds(where.directoryId).includes(d.id) && (d.contacts ?? 0) > 0)
      .map((d) => ({ directoryId: d.id, _count: { _all: d.contacts } }))
  );

  db.workspace.findMany.mockImplementation(
    async ({ where }: { where: { organizationId?: string; contactDirectoryId?: string } }) =>
      workspaces
        .filter((w) =>
          where.contactDirectoryId === undefined
            ? w.organizationId === where.organizationId
            : w.contactDirectoryId === where.contactDirectoryId
        )
        .map(({ id, name, contactDirectoryId }) => ({ id, name, contactDirectoryId }))
  );
  db.workspace.updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: unknown; contactDirectoryId: string | null };
      data: { contactDirectoryId: string | null };
    }) => {
      const matches = workspaces.filter(
        (w) => inIds(where.id).includes(w.id) && w.contactDirectoryId === where.contactDirectoryId
      );
      log.push(`set ${matches.map((w) => w.id).join(",")} to ${data.contactDirectoryId}`);
      for (const w of matches) w.contactDirectoryId = data.contactDirectoryId;
      return { count: matches.length };
    }
  );

  db.survey.findMany.mockImplementation(async ({ where }: { where: { workspaceId: unknown } }) =>
    surveys
      .filter((s) => s.targeted && inIds(where.workspaceId).includes(s.workspaceId))
      .map(({ id, name, workspaceId, status }) => ({ id, name, workspaceId, status }))
  );
  db.survey.updateMany.mockImplementation(
    async ({ where, data }: { where: { id: unknown }; data: { status: string } }) => {
      log.push(`pause ${inIds(where.id).join(",")}`);
      for (const s of surveys) if (inIds(where.id).includes(s.id)) s.status = data.status;
      return { count: inIds(where.id).length };
    }
  );
};

const ws = (id: string, contactDirectoryId: string | null, organizationId = ORG): TWorkspaceRow => ({
  id,
  name: `Workspace ${id}`,
  organizationId,
  contactDirectoryId,
});

const dir = (id: string, extra: Partial<TDirectoryRow> = {}): TDirectoryRow => ({
  id,
  organizationId: ORG,
  name: `Directory ${id}`,
  matchingKey: "email",
  isArchived: false,
  ...extra,
});

const survey = (id: string, workspaceId: string, targeted = true): TSurveyRow => ({
  id,
  name: `Survey ${id}`,
  workspaceId,
  targeted,
  status: "inProgress",
});

const directoryOf = (workspaceId: string) => workspaces.find((w) => w.id === workspaceId)?.contactDirectoryId;

beforeEach(() => vi.clearAllMocks());

describe("listContactDirectories", () => {
  test("lists every directory, archived ones included, with its workspaces, contacts and status", async () => {
    setup({
      ws: [ws("w1", "d1"), ws("w2", "d1"), ws("w3", null)],
      dirs: [
        dir("d1", { name: "Northwind EU", contacts: 18402 }),
        dir("d2", { matchingKey: "userId", isArchived: true, contacts: 3 }),
      ],
    });

    const list = await listContactDirectories(ORG);

    expect(list.directories).toEqual([
      {
        id: "d1",
        name: "Northwind EU",
        matchingKey: "email",
        isArchived: false,
        workspaces: [
          { id: "w1", name: "Workspace w1" },
          { id: "w2", name: "Workspace w2" },
        ],
        contactCount: 18402,
      },
      {
        id: "d2",
        name: "Directory d2",
        matchingKey: "userId",
        isArchived: true,
        workspaces: [],
        contactCount: 3,
      },
    ]);
    expect(list.workspaces).toContainEqual({ id: "w3", name: "Workspace w3", directoryId: null });
  });
});

describe("getContactDirectory", () => {
  test("returns one directory of the organization, and nothing for another organization's", async () => {
    setup({
      ws: [ws("w1", "d1")],
      dirs: [dir("d1", { name: "EU" }), dir("dx", { organizationId: OTHER_ORG })],
    });

    await expect(getContactDirectory(ORG, "d1")).resolves.toMatchObject({ id: "d1", name: "EU" });
    await expect(getContactDirectory(ORG, "dx")).resolves.toBeNull();
  });
});

describe("getContactDirectoryTargetedSurveys", () => {
  test("lists each workspace of the directory with its targeted surveys, scheduled ones named so", async () => {
    setup({
      ws: [ws("w1", "d1"), ws("w2", "d1"), ws("w3", "d2")],
      dirs: [dir("d1"), dir("d2")],
      srv: [
        survey("s1", "w1"),
        { ...survey("s2", "w1"), status: "paused" },
        survey("s3", "w1", false),
        survey("s4", "w3"),
      ],
    });

    await expect(getContactDirectoryTargetedSurveys(ORG, "d1")).resolves.toEqual({
      workspaces: [
        {
          workspaceId: "w1",
          surveys: [
            { id: "s1", name: "Survey s1", status: "inProgress" },
            { id: "s2", name: "Survey s2", status: "scheduled" },
          ],
          totalCount: 2,
        },
        { workspaceId: "w2", surveys: [], totalCount: 0 },
      ],
    });
  });

  test("lists at most the limit per workspace and counts them all", async () => {
    const many = Array.from({ length: CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT + 3 }, (_, index) =>
      survey(`s${String(index).padStart(3, "0")}`, "w1")
    );
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1")], srv: many });

    const targeted = await getContactDirectoryTargetedSurveys(ORG, "d1");

    expect(targeted?.workspaces[0].surveys).toHaveLength(CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT);
    expect(targeted?.workspaces[0].totalCount).toBe(CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT + 3);
  });

  test("answers nothing for another organization's directory", async () => {
    setup({ ws: [], dirs: [dir("dx", { organizationId: OTHER_ORG })] });

    await expect(getContactDirectoryTargetedSurveys(ORG, "dx")).resolves.toBeNull();
  });
});

describe("createContactDirectory", () => {
  test.each(["email", "userId"] as const)(
    "gives a %s directory the five default keys, with no externalId",
    async (matchingKey) => {
      setup({ ws: [ws("w1", null)], dirs: [] });

      await createContactDirectory({ organizationId: ORG, name: "EU", matchingKey, workspaceIds: ["w1"] });

      const { data } = db.contactAttributeKey.createMany.mock.calls[0][0];
      expect(data.map(({ key }: { key: string }) => key)).toEqual([
        "userId",
        "email",
        "firstName",
        "lastName",
        "language",
      ]);
      expect(directoryOf("w1")).toBe("clnewdir00000000000000000");
    }
  );

  // Decision 3: no implicit move, and so no implicit delete of the directory it would leave.
  test("refuses a workspace that uses another directory, and leaves that directory alone", async () => {
    setup({ ws: [ws("w1", null), ws("w2", "d1")], dirs: [dir("d1")] });

    const attempt = createContactDirectory({
      organizationId: ORG,
      name: "EU",
      matchingKey: "email",
      workspaceIds: ["w1", "w2"],
    });

    await expect(attempt).rejects.toBeInstanceOf(ContactDirectoryWorkspacesInOtherDirectoryError);
    await expect(attempt).rejects.toMatchObject({ workspaceIds: ["w2"] });
    expect(db.workspace.updateMany).not.toHaveBeenCalled();
    expect(directoryOf("w2")).toBe("d1");
  });

  test("refuses a workspace of another organization as if it did not exist", async () => {
    setup({ ws: [ws("w1", null, OTHER_ORG)], dirs: [] });

    await expect(
      createContactDirectory({ organizationId: ORG, name: "EU", matchingKey: "email", workspaceIds: ["w1"] })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesNotFoundError);
  });

  test("reports a name the organization already uses", async () => {
    setup({ ws: [ws("w1", null)], dirs: [] });
    db.contactDirectory.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    await expect(
      createContactDirectory({ organizationId: ORG, name: "EU", matchingKey: "email", workspaceIds: ["w1"] })
    ).rejects.toBeInstanceOf(ContactDirectoryNameTakenError);
  });
});

describe("updateContactDirectory", () => {
  test("renames the directory under its lock and returns the before and after", async () => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1")] });

    const result = await updateContactDirectory({ organizationId: ORG, directoryId: "d1", name: " Nw " });

    expect(log).toEqual(["lock directory d1", 'update directory d1 {"name":"Nw","isArchived":false}']);
    expect(result).toEqual({
      previous: { name: "Directory d1", workspaceIds: ["w1"], isArchived: false },
      next: { name: "Nw", workspaceIds: ["w1"], isArchived: false, pausedSurveyIds: [] },
    });
  });

  test.each(["", "   "])("refuses a blank name (%j)", async (name) => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1", { name: "Old" })] });

    await expect(
      updateContactDirectory({ organizationId: ORG, directoryId: "d1", name })
    ).rejects.toBeInstanceOf(ContactDirectoryNameRequiredError);
    expect(db.contactDirectory.update).not.toHaveBeenCalled();
  });

  test("adds a workspace with no directory, locking the directory before the workspaces", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", null)], dirs: [dir("d1")] });

    await updateContactDirectory({ organizationId: ORG, directoryId: "d1", workspaceIds: ["w1", "w2"] });

    expect(log.slice(0, 3)).toEqual(["lock directory d1", "lock workspaces w2", "set w2 to d1"]);
    expect(directoryOf("w2")).toBe("d1");
  });

  test("refuses to take a workspace from another directory", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", "d2")], dirs: [dir("d1"), dir("d2")] });

    await expect(
      updateContactDirectory({ organizationId: ORG, directoryId: "d1", workspaceIds: ["w1", "w2"] })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesInOtherDirectoryError);
    expect(directoryOf("w2")).toBe("d2");
  });

  // Decision 1: removal only unlinks the workspace; nothing else is written.
  test("removes a workspace by clearing its directory only", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", "d1")], dirs: [dir("d1")], srv: [survey("s1", "w2")] });

    const result = await updateContactDirectory({
      organizationId: ORG,
      directoryId: "d1",
      workspaceIds: ["w1"],
    });

    expect(directoryOf("w2")).toBeNull();
    expect(db.survey.updateMany).not.toHaveBeenCalled();
    expect(db.segment.updateMany).not.toHaveBeenCalled();
    expect(db.contact.updateMany).not.toHaveBeenCalled();
    expect(result.next).toEqual({
      name: "Directory d1",
      workspaceIds: ["w1"],
      isArchived: false,
      pausedSurveyIds: [],
    });
  });

  test("pauses the targeted surveys only of removed workspaces it was asked to", async () => {
    setup({
      ws: [ws("w1", "d1"), ws("w2", "d1"), ws("w3", "d1")],
      dirs: [dir("d1")],
      srv: [survey("s1", "w1"), survey("s2", "w2"), survey("s3", "w3"), survey("s4", "w2", false)],
    });

    const result = await updateContactDirectory({
      organizationId: ORG,
      directoryId: "d1",
      workspaceIds: ["w1"],
      // w1 stays, so its survey keeps running; w3 is removed without pausing.
      pauseSurveysInWorkspaceIds: ["w1", "w2"],
    });

    expect(surveys.map(({ id, status }) => [id, status])).toEqual([
      ["s1", "inProgress"],
      ["s2", "paused"],
      ["s3", "inProgress"],
      ["s4", "inProgress"],
    ]);
    expect(result.next.pausedSurveyIds).toEqual(["s2"]);
    expect(log.indexOf("pause s2")).toBeLessThan(log.indexOf("set w2,w3 to null"));
  });

  test("leaves the directory active with no workspaces when its last workspace is removed", async () => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1")] });

    const result = await updateContactDirectory({ organizationId: ORG, directoryId: "d1", workspaceIds: [] });

    expect(directories[0].isArchived).toBe(false);
    expect(directoryOf("w1")).toBeNull();
    expect(result.next).toMatchObject({ workspaceIds: [], isArchived: false });
  });

  test("removes the last workspace and archives the directory in one save when asked", async () => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1")] });

    const result = await updateContactDirectory({
      organizationId: ORG,
      directoryId: "d1",
      workspaceIds: [],
      isArchived: true,
    });

    expect(directories[0].isArchived).toBe(true);
    expect(directoryOf("w1")).toBeNull();
    expect(result.next).toMatchObject({ workspaceIds: [], isArchived: true });
  });

  test("refuses to archive a directory that still has workspaces", async () => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1")] });

    await expect(
      updateContactDirectory({ organizationId: ORG, directoryId: "d1", isArchived: true })
    ).rejects.toBeInstanceOf(ContactDirectoryArchiveHasWorkspacesError);
    expect(directories[0].isArchived).toBe(false);
  });

  test("archives a directory with no workspaces", async () => {
    setup({ ws: [], dirs: [dir("d1")] });

    await updateContactDirectory({ organizationId: ORG, directoryId: "d1", isArchived: true });

    expect(directories[0].isArchived).toBe(true);
  });

  test("unarchives a directory without giving it a workspace", async () => {
    setup({ ws: [], dirs: [dir("d1", { isArchived: true })] });

    const result = await updateContactDirectory({
      organizationId: ORG,
      directoryId: "d1",
      isArchived: false,
    });

    expect(directories[0].isArchived).toBe(false);
    expect(result.next).toMatchObject({ workspaceIds: [], isArchived: false });
  });

  test("keeps a directory active when a save removes every workspace and asks it to stay active", async () => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1")] });

    await updateContactDirectory({
      organizationId: ORG,
      directoryId: "d1",
      isArchived: false,
      workspaceIds: [],
    });

    expect(directories[0].isArchived).toBe(false);
    expect(directoryOf("w1")).toBeNull();
  });

  test("gives an archived directory workspaces only when the same save unarchives it", async () => {
    setup({ ws: [ws("w1", null)], dirs: [dir("d1", { isArchived: true })] });

    await expect(
      updateContactDirectory({ organizationId: ORG, directoryId: "d1", workspaceIds: ["w1"] })
    ).rejects.toBeInstanceOf(ContactDirectoryArchivedError);
    expect(directoryOf("w1")).toBeNull();

    await updateContactDirectory({
      organizationId: ORG,
      directoryId: "d1",
      workspaceIds: ["w1"],
      isArchived: false,
    });

    expect(directoryOf("w1")).toBe("d1");
    expect(directories[0].isArchived).toBe(false);
  });

  test("answers not found for a directory of another organization", async () => {
    setup({ ws: [], dirs: [dir("dx", { organizationId: OTHER_ORG })] });

    await expect(
      updateContactDirectory({ organizationId: ORG, directoryId: "dx", name: "Mine now" })
    ).rejects.toBeInstanceOf(ContactDirectoryNotFoundError);
  });
});

describe("getSharedContactDirectoryName", () => {
  test("names the directory only when two or more workspaces use it", async () => {
    db.workspace.findUnique.mockResolvedValueOnce({
      contactDirectory: { name: "Northwind EU", _count: { workspaces: 2 } },
    });
    await expect(getSharedContactDirectoryName("w1")).resolves.toBe("Northwind EU");

    db.workspace.findUnique.mockResolvedValueOnce({
      contactDirectory: { name: "Solo", _count: { workspaces: 1 } },
    });
    await expect(getSharedContactDirectoryName("w1")).resolves.toBeNull();

    db.workspace.findUnique.mockResolvedValueOnce({ contactDirectory: null });
    await expect(getSharedContactDirectoryName("w1")).resolves.toBeNull();
  });
});
