import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { getDefaultAttributeKeys } from "./constants";
import {
  ContactDirectoryNameRequiredError,
  ContactDirectoryNameTakenError,
  ContactDirectoryNotFoundError,
  ContactDirectoryWorkspacesCannotLeaveError,
  ContactDirectoryWorkspacesNotFoundError,
  ContactDirectoryWorkspacesNotMovableError,
  createContactDirectory,
  getContactDirectory,
  getSharedContactDirectoryName,
  listContactDirectories,
  updateContactDirectory,
} from "./directory-service";

vi.mock("server-only", () => ({}));

/**
 * One fake client serves as both `prisma` and the transaction client. It holds a tiny organization in
 * memory and answers the service's queries from it, so the tests read as "given these directories, this
 * happens" instead of as a list of mocked calls. `log` records the order of locks, reads and writes,
 * which is what the move rule (decision 8) depends on.
 */
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  contactDirectory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  contactAttributeKey: { groupBy: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  workspace: { findMany: vi.fn(), findUnique: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn() },
  contact: { groupBy: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  segment: { groupBy: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@formbricks/database", () => ({ prisma: db }));

const ORG = "clorg000000000000000000000";
const OTHER_ORG = "clorg999999999999999999999";

type TWorkspaceRow = { id: string; name: string; organizationId: string; contactDirectoryId: string | null };
type TDirectoryRow = {
  id: string;
  organizationId: string;
  name: string | null;
  matchingKey: "email" | "externalId";
  contacts?: number;
  blockingKeys?: number;
};
type TSegmentRow = {
  id: string;
  directoryId: string | null;
  workspaceId: string;
  isPrivate: boolean;
  filters: unknown;
};

let workspaces: TWorkspaceRow[];
let directories: TDirectoryRow[];
let segments: TSegmentRow[];
let log: string[];

const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values as string[] };
};

const countBy = <T>(rows: T[], key: (row: T) => string | null, ids: string[]) =>
  ids
    .map((id) => ({ id, count: rows.filter((row) => key(row) === id).length }))
    .filter(({ count }) => count > 0);

const idsIn = (where: { [field: string]: unknown }, field: string): string[] =>
  (where[field] as { in: string[] }).in;

const setup = ({
  ws,
  dirs,
  segs = [],
}: {
  ws: TWorkspaceRow[];
  dirs: TDirectoryRow[];
  segs?: TSegmentRow[];
}) => {
  workspaces = ws.map((w) => ({ ...w }));
  directories = dirs.map((d) => ({ ...d }));
  segments = segs.map((seg) => ({ ...seg }));
  log = [];

  db.$transaction.mockImplementation(((fn: (client: typeof db) => unknown) => fn(db)) as never);

  db.$queryRaw.mockImplementation(async (...args: unknown[]) => {
    const { text, values } = statement(args);
    const [organizationId, ...ids] = values;
    if (text.includes('FROM "Workspace"')) {
      log.push(`lock workspaces ${ids.join(",")}`);
      return workspaces
        .filter((w) => w.organizationId === organizationId && ids.includes(w.id))
        .map(({ id, contactDirectoryId }) => ({ id, contactDirectoryId }));
    }
    if (text.includes('FROM "ContactDirectory"')) {
      log.push(`lock directories ${ids.join(",")}`);
      return directories
        .filter((d) => d.organizationId === organizationId && ids.includes(d.id))
        .map(({ id, name, matchingKey }) => ({ id, name, matchingKey }));
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });

  db.contactDirectory.findMany.mockImplementation(async ({ where }: { where: { organizationId: string } }) =>
    directories
      .filter((d) => d.organizationId === where.organizationId)
      .map(({ id, name, matchingKey }) => ({ id, name, matchingKey }))
  );
  db.contactDirectory.findFirst.mockImplementation(
    async ({ where }: { where: { id: string; organizationId: string } }) => {
      const found = directories.find((d) => d.id === where.id && d.organizationId === where.organizationId);
      return found ? { id: found.id, name: found.name, matchingKey: found.matchingKey } : null;
    }
  );
  db.contactDirectory.create.mockImplementation(async ({ data }: { data: Omit<TDirectoryRow, "id"> }) => {
    log.push("create directory");
    const created = { id: "clnewdir00000000000000000", ...data };
    directories.push(created);
    return { id: created.id };
  });
  db.contactDirectory.update.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: { name: string | null } }) => {
      log.push(`rename ${where.id}`);
      const directory = directories.find((d) => d.id === where.id)!;
      directory.name = data.name;
      return { id: directory.id };
    }
  );
  db.contactDirectory.deleteMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) => {
      log.push(`delete directories ${where.id.in.join(",")}`);
      directories = directories.filter((d) => !where.id.in.includes(d.id));
      return { count: where.id.in.length };
    }
  );
  db.contactAttributeKey.createMany.mockImplementation(async () => {
    log.push("create default keys");
    return { count: 0 };
  });

  db.workspace.findMany.mockImplementation(
    async ({
      where,
    }: {
      where: { organizationId?: string; contactDirectoryId?: string | { in: string[] } };
    }) =>
      workspaces
        .filter((w) => {
          if (where.organizationId) return w.organizationId === where.organizationId;
          if (typeof where.contactDirectoryId === "string")
            return w.contactDirectoryId === where.contactDirectoryId;
          return where.contactDirectoryId?.in.includes(w.contactDirectoryId ?? "");
        })
        .map(({ id, name, contactDirectoryId }) => ({ id, name, contactDirectoryId }))
  );
  db.workspace.updateMany.mockImplementation(
    async ({ where, data }: { where: { id: { in: string[] } }; data: { contactDirectoryId: string } }) => {
      log.push(`move ${where.id.in.join(",")} to ${data.contactDirectoryId}`);
      for (const w of workspaces)
        if (where.id.in.includes(w.id)) w.contactDirectoryId = data.contactDirectoryId;
      return { count: where.id.in.length };
    }
  );
  db.workspace.groupBy.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    log.push("count workspaces");
    return countBy(workspaces, (w) => w.contactDirectoryId, idsIn(where, "contactDirectoryId")).map(
      ({ id, count }) => ({ contactDirectoryId: id, _count: { _all: count } })
    );
  });

  db.segment.groupBy.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    log.push("count public segments");
    expect(where.isPrivate).toBe(false);
    return countBy(
      segments.filter((seg) => !seg.isPrivate),
      (seg) => seg.directoryId,
      idsIn(where, "directoryId")
    ).map(({ id, count }) => ({ directoryId: id, _count: { _all: count } }));
  });
  db.segment.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    // The public segments a workspace with no directory has (none here: the integration test covers them).
    if (where.directoryId === null) return [];
    log.push("read private segment filters");
    return segments
      .filter((seg) => seg.isPrivate && idsIn(where, "directoryId").includes(seg.directoryId ?? ""))
      .map(({ directoryId, filters }) => ({ directoryId, filters }));
  });
  db.segment.updateMany.mockImplementation(
    async ({ where, data }: { where: Record<string, unknown>; data: { directoryId: string } }) => {
      const matches = segments.filter((seg) => {
        if (!seg.isPrivate) return false;
        if (where.directoryId === null) {
          return seg.directoryId === null && idsIn(where, "workspaceId").includes(seg.workspaceId);
        }
        return idsIn(where, "directoryId").includes(seg.directoryId ?? "");
      });
      log.push(`re-point private segments ${matches.map((seg) => seg.id).join(",")}`);
      for (const seg of matches) seg.directoryId = data.directoryId;
      return { count: matches.length };
    }
  );

  const contentCount =
    (field: "contacts" | "blockingKeys", label: string) =>
    async ({ where }: { where: Record<string, unknown> }) => {
      log.push(label);
      return directories
        .filter((d) => idsIn(where, "directoryId").includes(d.id) && (d[field] ?? 0) > 0)
        .map((d) => ({ directoryId: d.id, _count: { _all: d[field] } }));
    };
  db.contact.groupBy.mockImplementation(contentCount("contacts", "count contacts"));
  // Under the move's lock only whether a directory has a contact is read. Rows a previous-release pod
  // wrote for a workspace with no directory: none here, the integration test covers their adoption.
  db.contact.findFirst.mockImplementation(
    async ({ where }: { where: { directoryId: string | null; workspaceId?: string } }) => {
      if (where.directoryId === null) {
        log.push(`check orphan contacts ${where.workspaceId}`);
        return null;
      }
      log.push(`check contacts ${where.directoryId}`);
      const directory = directories.find((d) => d.id === where.directoryId);
      return (directory?.contacts ?? 0) > 0 ? { id: "contact" } : null;
    }
  );
  db.contact.updateMany.mockResolvedValue({ count: 0 });
  // A directory's keys are its defaults; a workspace with no directory has none (see above).
  db.contactAttributeKey.findMany.mockImplementation(
    async ({ where }: { where: { directoryId?: string | null; key?: { in: string[] } } }) => {
      const directory = directories.find((d) => d.id === where.directoryId);
      if (!directory) return [];
      return getDefaultAttributeKeys(directory.matchingKey)
        .filter(({ key }) => where.key?.in.includes(key) ?? true)
        .map(({ key }) => ({ id: `${directory.id}-${key}`, key }));
    }
  );
  db.contactAttributeKey.groupBy.mockImplementation(contentCount("blockingKeys", "count blocking keys"));
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
  name: null,
  matchingKey: "email",
  ...extra,
});

const seg = (
  id: string,
  directoryId: string | null,
  workspaceId: string,
  extra: Partial<TSegmentRow> = {}
): TSegmentRow => ({ id, directoryId, workspaceId, isPrivate: true, filters: [], ...extra });

/** A stored segment filter list with one attribute filter on `key`. */
const filterOn = (key: string) => [
  {
    id: "f1",
    connector: null,
    resource: {
      id: "r1",
      root: { type: "attribute", contactAttributeKey: key },
      value: "x",
      qualifier: { operator: "equals" },
    },
  },
];

describe("listContactDirectories", () => {
  beforeEach(() => vi.clearAllMocks());

  test("lists each directory with its workspaces and contacts, and says whether its workspace can move", async () => {
    setup({
      ws: [ws("w1", "d1"), ws("w2", "d2"), ws("w3", "d2"), ws("w4", "d3"), ws("w5", null)],
      dirs: [
        dir("d1"),
        dir("d2", { name: "Northwind EU", contacts: 18402 }),
        dir("d3", { matchingKey: "externalId", contacts: 3 }),
      ],
    });

    const list = await listContactDirectories(ORG);

    expect(list.directories).toEqual([
      {
        id: "d1",
        name: null,
        matchingKey: "email",
        workspaces: [{ id: "w1", name: "Workspace w1" }],
        contactCount: 0,
        workspaceCanMove: true,
      },
      {
        id: "d2",
        name: "Northwind EU",
        matchingKey: "email",
        workspaces: [
          { id: "w2", name: "Workspace w2" },
          { id: "w3", name: "Workspace w3" },
        ],
        contactCount: 18402,
        workspaceCanMove: false,
      },
      {
        id: "d3",
        name: null,
        matchingKey: "externalId",
        workspaces: [{ id: "w4", name: "Workspace w4" }],
        contactCount: 3,
        workspaceCanMove: false,
      },
    ]);
    expect(list.workspaces).toContainEqual({ id: "w5", name: "Workspace w5", directoryId: null });
    expect(list.workspaces).toContainEqual({ id: "w2", name: "Workspace w2", directoryId: "d2" });
  });

  test("a public segment, a key beyond the defaults or a survey filter on one keeps a lone workspace where it is", async () => {
    setup({
      ws: [ws("w1", "d1"), ws("w2", "d2"), ws("w3", "d3"), ws("w4", "d4")],
      dirs: [dir("d1"), dir("d2", { blockingKeys: 1 }), dir("d3"), dir("d4")],
      segs: [
        seg("s1", "d1", "w1", { isPrivate: false }),
        seg("s3", "d3", "w3", { filters: filterOn("plan") }),
        seg("s4", "d4", "w4", { filters: filterOn("email") }),
      ],
    });

    const { directories: listed } = await listContactDirectories(ORG);

    // d4's survey filter names a default key, which the new directory has too.
    expect(listed.map((d) => d.workspaceCanMove)).toEqual([false, false, false, true]);
  });

  test("counts only keys that block a move: custom keys, externalId in an email directory, and keys in survey filters", async () => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1")] });

    await listContactDirectories(ORG);

    const { where } = db.contactAttributeKey.groupBy.mock.calls[0][0];
    expect(where).toEqual({
      directoryId: { in: ["d1"] },
      OR: [
        { key: { notIn: ["userId", "email", "firstName", "lastName", "language", "externalId"] } },
        { key: "externalId", directory: { matchingKey: "email" } },
        { attributeFilters: { some: {} } },
      ],
    });
  });
});

describe("getContactDirectory", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns one directory of the organization, and nothing for another organization's", async () => {
    setup({
      ws: [ws("w1", "d1")],
      dirs: [dir("d1", { name: "EU" }), dir("dx", { organizationId: OTHER_ORG })],
    });

    await expect(getContactDirectory(ORG, "d1")).resolves.toMatchObject({ id: "d1", name: "EU" });
    await expect(getContactDirectory(ORG, "dx")).resolves.toBeNull();
  });
});

describe("createContactDirectory", () => {
  beforeEach(() => vi.clearAllMocks());

  test("creates the directory with its default keys and moves a workspace out of its empty directory, which is deleted", async () => {
    setup({
      ws: [ws("w1", "d1"), ws("w2", null)],
      dirs: [dir("d1")],
      segs: [seg("s1", "d1", "w1"), seg("s2", null, "w2")],
    });

    const created = await createContactDirectory({
      organizationId: ORG,
      name: "  Northwind EU ",
      matchingKey: "email",
      workspaceIds: ["w2", "w1"],
    });

    expect(created.id).toBe("clnewdir00000000000000000");
    expect(db.contactDirectory.create).toHaveBeenCalledWith({
      data: { organizationId: ORG, name: "Northwind EU", matchingKey: "email" },
      select: { id: true },
    });
    expect(log).toEqual([
      "create directory",
      "create default keys",
      "lock workspaces w1,w2",
      "lock directories d1",
      "count workspaces",
      "check contacts d1",
      "count public segments",
      "count blocking keys",
      "read private segment filters",
      "check orphan contacts w2",
      "move w1,w2 to clnewdir00000000000000000",
      "re-point private segments s1",
      "re-point private segments s2",
      "delete directories d1",
    ]);
    expect(workspaces.map((w) => w.contactDirectoryId)).toEqual([
      "clnewdir00000000000000000",
      "clnewdir00000000000000000",
    ]);
  });

  test("keeps the surveys' private segments: they move to the new directory before the old one is deleted", async () => {
    setup({
      ws: [ws("w1", "d1")],
      dirs: [dir("d1")],
      segs: [seg("survey1", "d1", "w1"), seg("survey2", "d1", "w1", { filters: filterOn("language") })],
    });

    await createContactDirectory({
      organizationId: ORG,
      name: null,
      matchingKey: "email",
      workspaceIds: ["w1"],
    });

    expect(segments.map((s) => s.directoryId)).toEqual([
      "clnewdir00000000000000000",
      "clnewdir00000000000000000",
    ]);
    expect(log.indexOf("re-point private segments survey1,survey2")).toBeLessThan(
      log.indexOf("delete directories d1")
    );
  });

  test("refuses a workspace whose survey filters name a key beyond the defaults", async () => {
    setup({
      ws: [ws("w1", "d1")],
      dirs: [dir("d1")],
      segs: [
        seg("survey1", "d1", "w1", { filters: [{ id: "g", connector: null, resource: filterOn("plan") }] }),
      ],
    });

    await expect(
      createContactDirectory({ organizationId: ORG, name: null, matchingKey: "email", workspaceIds: ["w1"] })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesNotMovableError);
    expect(db.contactDirectory.deleteMany).not.toHaveBeenCalled();
  });

  test("gives an email directory the five default keys, with no workspace of origin", async () => {
    setup({ ws: [ws("w1", null)], dirs: [] });

    await createContactDirectory({
      organizationId: ORG,
      name: null,
      matchingKey: "email",
      workspaceIds: ["w1"],
    });

    const { data } = db.contactAttributeKey.createMany.mock.calls[0][0];
    expect(data.map((key: { key: string }) => key.key)).toEqual([
      "userId",
      "email",
      "firstName",
      "lastName",
      "language",
    ]);
    expect(data[0]).toMatchObject({
      directoryId: "clnewdir00000000000000000",
      type: "default",
      isUnique: true,
    });
    expect(data[0]).not.toHaveProperty("workspaceId");
  });

  test("adds externalId to the default keys of an external-ID directory", async () => {
    setup({ ws: [ws("w1", null)], dirs: [] });

    await createContactDirectory({
      organizationId: ORG,
      name: null,
      matchingKey: "externalId",
      workspaceIds: ["w1"],
    });

    const { data } = db.contactAttributeKey.createMany.mock.calls[0][0];
    expect(data.map((key: { key: string }) => key.key)).toContain("externalId");
    expect(data).toHaveLength(6);
  });

  test("refuses a workspace whose directory has a contact by the time the lock is held, and moves nothing", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", null)], dirs: [dir("d1", { contacts: 1 })] });

    const attempt = createContactDirectory({
      organizationId: ORG,
      name: "EU",
      matchingKey: "email",
      workspaceIds: ["w1", "w2"],
    });

    await expect(attempt).rejects.toBeInstanceOf(ContactDirectoryWorkspacesNotMovableError);
    await expect(attempt).rejects.toMatchObject({ workspaceIds: ["w1"] });
    expect(db.workspace.updateMany).not.toHaveBeenCalled();
    expect(db.contactDirectory.deleteMany).not.toHaveBeenCalled();
  });

  test("refuses to take a workspace out of a shared directory", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", "d1")], dirs: [dir("d1", { name: "Shared" })] });

    await expect(
      createContactDirectory({ organizationId: ORG, name: null, matchingKey: "email", workspaceIds: ["w1"] })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesNotMovableError);
  });

  test("refuses a workspace of another organization as if it did not exist", async () => {
    setup({ ws: [ws("w1", null), ws("wx", null, OTHER_ORG)], dirs: [] });

    const attempt = createContactDirectory({
      organizationId: ORG,
      name: "EU",
      matchingKey: "email",
      workspaceIds: ["w1", "wx"],
    });

    await expect(attempt).rejects.toBeInstanceOf(ContactDirectoryWorkspacesNotFoundError);
    await expect(attempt).rejects.toMatchObject({ workspaceIds: ["wx"] });
    expect(db.workspace.updateMany).not.toHaveBeenCalled();
  });

  test("requires a name for two or more workspaces, before writing anything", async () => {
    setup({ ws: [ws("w1", null), ws("w2", null)], dirs: [] });

    await expect(
      createContactDirectory({
        organizationId: ORG,
        name: "   ",
        matchingKey: "email",
        workspaceIds: ["w1", "w2"],
      })
    ).rejects.toBeInstanceOf(ContactDirectoryNameRequiredError);
    expect(db.contactDirectory.create).not.toHaveBeenCalled();
  });

  test("reports a name the organization already uses", async () => {
    setup({ ws: [ws("w1", null)], dirs: [] });
    db.contactDirectory.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "x",
      })
    );

    await expect(
      createContactDirectory({ organizationId: ORG, name: "EU", matchingKey: "email", workspaceIds: ["w1"] })
    ).rejects.toBeInstanceOf(ContactDirectoryNameTakenError);
  });
});

describe("updateContactDirectory", () => {
  beforeEach(() => vi.clearAllMocks());

  test("renames the directory under its lock and returns the before and after", async () => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1")] });

    const result = await updateContactDirectory({
      organizationId: ORG,
      directoryId: "d1",
      name: " Northwind ",
    });

    expect(log.slice(0, 2)).toEqual(["lock directories d1", "rename d1"]);
    expect(result).toEqual({
      previous: { name: null, workspaceIds: ["w1"] },
      next: { name: "Northwind", workspaceIds: ["w1"] },
    });
  });

  test("an empty name keeps a one-workspace directory unnamed", async () => {
    setup({ ws: [ws("w1", "d1")], dirs: [dir("d1", { name: "Old" })] });

    const result = await updateContactDirectory({ organizationId: ORG, directoryId: "d1", name: "" });

    expect(result.next.name).toBeNull();
  });

  test("adds a workspace whose own directory is empty and deletes that directory, after locking the target first", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", "d2")], dirs: [dir("d1", { name: "EU" }), dir("d2")] });

    const result = await updateContactDirectory({
      organizationId: ORG,
      directoryId: "d1",
      workspaceIds: ["w1", "w2"],
    });

    expect(log[0]).toBe("lock directories d1");
    expect(log).toContain("lock workspaces w1,w2");
    expect(log).toContain("lock directories d2");
    expect(log.indexOf("move w2 to d1")).toBeLessThan(log.indexOf("delete directories d2"));
    expect(workspaces.map((w) => w.contactDirectoryId)).toEqual(["d1", "d1"]);
    expect(directories.map((d) => d.id)).toEqual(["d1"]);
    expect(result.next.workspaceIds).toEqual(["w1", "w2"]);
  });

  test("requires a name before a second workspace joins", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", null)], dirs: [dir("d1")] });

    await expect(
      updateContactDirectory({ organizationId: ORG, directoryId: "d1", workspaceIds: ["w1", "w2"] })
    ).rejects.toBeInstanceOf(ContactDirectoryNameRequiredError);
    expect(db.workspace.updateMany).not.toHaveBeenCalled();
  });

  test("refuses to clear the name of a shared directory", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", "d1")], dirs: [dir("d1", { name: "Shared" })] });

    await expect(
      updateContactDirectory({ organizationId: ORG, directoryId: "d1", name: "" })
    ).rejects.toBeInstanceOf(ContactDirectoryNameRequiredError);
    expect(db.contactDirectory.update).not.toHaveBeenCalled();
  });

  test("refuses to let a workspace leave the directory", async () => {
    setup({ ws: [ws("w1", "d1"), ws("w2", "d1")], dirs: [dir("d1", { name: "Shared" })] });

    const attempt = updateContactDirectory({ organizationId: ORG, directoryId: "d1", workspaceIds: ["w1"] });

    await expect(attempt).rejects.toBeInstanceOf(ContactDirectoryWorkspacesCannotLeaveError);
    await expect(attempt).rejects.toMatchObject({ workspaceIds: ["w2"] });
  });

  test("answers not found for a directory of another organization", async () => {
    setup({ ws: [], dirs: [dir("dx", { organizationId: OTHER_ORG })] });

    await expect(
      updateContactDirectory({ organizationId: ORG, directoryId: "dx", name: "Mine now" })
    ).rejects.toBeInstanceOf(ContactDirectoryNotFoundError);
  });
});

describe("getSharedContactDirectoryName", () => {
  beforeEach(() => vi.clearAllMocks());

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
