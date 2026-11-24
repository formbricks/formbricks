import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import {
  MemberAttributeKeyConflictError,
  MemberAttributeKeyInUseError,
  MemberAttributeKeyLimitError,
  MemberAttributeKeyNotFoundError,
  MemberAttributeKeyTakenError,
} from "./errors";
import { MEMBER_ATTRIBUTE_LIST_MAX_LIMIT, MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION } from "./limits";
import {
  applyMemberAttributeWrites,
  copyInviteAttributeValuesToMembership,
  createAttributeKey,
  deleteAttributeKey,
  getAttributeKey,
  getMemberAttributeValuesByKey,
  getMemberAttributes,
  listAttributeKeysWithUsage,
  listMemberAttributeRows,
  listMembersWithAttributes,
  matchEmailsInOrganization,
  readInviteAttributeValues,
  updateAttributeKey,
} from "./service";

vi.mock("server-only", () => ({}));

const ORG = "org_1";
const t0 = new Date("2026-01-01T00:00:00.000Z");
const t1 = new Date("2026-01-02T00:00:00.000Z");

const key = (id: string, keyName: string) => ({
  id,
  key: keyName,
  label: keyName.toUpperCase(),
  description: null,
  createdAt: t0,
  updatedAt: t0,
});

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("db error", { code, clientVersion: "test" });

const runTransactionsInline = () => {
  prisma.$transaction.mockImplementation(((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never);
};

beforeEach(() => {
  runTransactionsInline();
});

describe("listAttributeKeysWithUsage", () => {
  test("adds usage counts per key and zero for keys nobody holds", async () => {
    prisma.memberAttributeKey.findMany.mockResolvedValue([key("k1", "country"), key("k2", "city")] as never);
    prisma.$queryRaw.mockResolvedValue([
      { attributeKeyId: "k1", memberCount: BigInt(3), distinctValueCount: BigInt(2) },
    ] as never);

    const result = await listAttributeKeysWithUsage(ORG);

    expect(
      result.map(({ id, memberCount, distinctValueCount }) => [id, memberCount, distinctValueCount])
    ).toEqual([
      ["k1", 3, 2],
      ["k2", 0, 0],
    ]);
    expect(prisma.memberAttributeKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        take: MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION,
      })
    );
  });
});

describe("getAttributeKey", () => {
  test("looks the key up inside the organization", async () => {
    prisma.memberAttributeKey.findFirst.mockResolvedValue(null);
    expect(await getAttributeKey(ORG, "k1")).toBeNull();
    expect(prisma.memberAttributeKey.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "k1", organizationId: ORG } })
    );
  });
});

describe("createAttributeKey", () => {
  const input = { key: "country", label: "Country", description: null };

  test("creates the key under the cap", async () => {
    prisma.memberAttributeKey.count.mockResolvedValue(0);
    prisma.memberAttributeKey.create.mockResolvedValue(key("k1", "country") as never);

    expect((await createAttributeKey(ORG, input)).id).toBe("k1");
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.memberAttributeKey.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { organizationId: ORG, ...input } })
    );
  });

  test("refuses at the per-organization cap", async () => {
    prisma.memberAttributeKey.count.mockResolvedValue(MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION);
    await expect(createAttributeKey(ORG, input)).rejects.toBeInstanceOf(MemberAttributeKeyLimitError);
    expect(prisma.memberAttributeKey.create).not.toHaveBeenCalled();
  });

  test("maps a unique violation to a taken key", async () => {
    prisma.memberAttributeKey.count.mockResolvedValue(0);
    prisma.memberAttributeKey.create.mockRejectedValue(knownError("P2002"));
    await expect(createAttributeKey(ORG, input)).rejects.toBeInstanceOf(MemberAttributeKeyTakenError);
  });

  test("rethrows any other error", async () => {
    prisma.memberAttributeKey.count.mockResolvedValue(0);
    prisma.memberAttributeKey.create.mockRejectedValue(new Error("boom"));
    await expect(createAttributeKey(ORG, input)).rejects.toThrow("boom");
  });
});

describe("updateAttributeKey", () => {
  test("refuses a key outside the organization", async () => {
    prisma.memberAttributeKey.findFirst.mockResolvedValue(null);
    await expect(updateAttributeKey(ORG, "k1", { label: "X", expectedUpdatedAt: t0 })).rejects.toBeInstanceOf(
      MemberAttributeKeyNotFoundError
    );
  });

  test("refuses a key changed since it was read, with its current updatedAt", async () => {
    prisma.memberAttributeKey.findFirst.mockResolvedValue({
      ...key("k1", "country"),
      updatedAt: t1,
    } as never);
    prisma.memberAttributeKey.updateMany.mockResolvedValue({ count: 0 });

    const error = await updateAttributeKey(ORG, "k1", { label: "X", expectedUpdatedAt: t0 }).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(MemberAttributeKeyConflictError);
    expect((error as MemberAttributeKeyConflictError).currentUpdatedAt).toEqual(t1);
  });

  test("changes only the fields sent and returns before and after", async () => {
    const before = key("k1", "country");
    const after = { ...before, description: "Where", updatedAt: t1 };
    prisma.memberAttributeKey.findFirst.mockResolvedValue(before as never);
    prisma.memberAttributeKey.updateMany.mockResolvedValue({ count: 1 });
    prisma.memberAttributeKey.findFirstOrThrow.mockResolvedValue(after as never);

    expect(await updateAttributeKey(ORG, "k1", { description: "Where", expectedUpdatedAt: t0 })).toEqual({
      before,
      after,
    });
    expect(prisma.memberAttributeKey.updateMany).toHaveBeenCalledWith({
      where: { id: "k1", organizationId: ORG, updatedAt: t0 },
      data: { description: "Where" },
    });
  });
});

describe("deleteAttributeKey", () => {
  test("refuses a key outside the organization", async () => {
    prisma.memberAttributeKey.findFirst.mockResolvedValue(null);
    await expect(deleteAttributeKey(ORG, "k1")).rejects.toBeInstanceOf(MemberAttributeKeyNotFoundError);
  });

  test("refuses a stale expectedUpdatedAt", async () => {
    prisma.memberAttributeKey.findFirst.mockResolvedValue({
      ...key("k1", "country"),
      updatedAt: t1,
    } as never);
    await expect(deleteAttributeKey(ORG, "k1", t0)).rejects.toBeInstanceOf(MemberAttributeKeyConflictError);
    expect(prisma.memberAttributeKey.delete).not.toHaveBeenCalled();
  });

  test("refuses while a Feedback Dataset's viewer access uses the key", async () => {
    prisma.memberAttributeKey.findFirst.mockResolvedValue(key("k1", "country") as never);
    prisma.feedbackDirectory.findMany.mockResolvedValue([{ id: "ds_1", name: "Support" }] as never);
    prisma.feedbackDirectory.count.mockResolvedValue(4);

    const error = await deleteAttributeKey(ORG, "k1", t0).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MemberAttributeKeyInUseError);
    expect((error as MemberAttributeKeyInUseError).datasetCount).toBe(4);
    expect((error as MemberAttributeKeyInUseError).datasets).toEqual([{ id: "ds_1", name: "Support" }]);
    expect(prisma.memberAttributeKey.delete).not.toHaveBeenCalled();
  });

  test("deletes an unused key and returns it", async () => {
    const existing = key("k1", "country");
    prisma.memberAttributeKey.findFirst.mockResolvedValue(existing as never);
    prisma.feedbackDirectory.findMany.mockResolvedValue([]);
    prisma.feedbackDirectory.count.mockResolvedValue(0);

    expect(await deleteAttributeKey(ORG, "k1")).toEqual(existing);
    expect(prisma.memberAttributeKey.delete).toHaveBeenCalledWith({ where: { id: "k1" } });
  });

  test("reports the datasets when a condition added during the delete trips the foreign key", async () => {
    prisma.memberAttributeKey.findFirst.mockResolvedValue(key("k1", "country") as never);
    prisma.feedbackDirectory.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "ds_2", name: "Sales" }] as never);
    prisma.feedbackDirectory.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.memberAttributeKey.delete.mockRejectedValue(knownError("P2003"));

    const error = await deleteAttributeKey(ORG, "k1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MemberAttributeKeyInUseError);
    expect((error as MemberAttributeKeyInUseError).datasets).toEqual([{ id: "ds_2", name: "Sales" }]);
  });

  test("rethrows any other error", async () => {
    prisma.memberAttributeKey.findFirst.mockRejectedValue(new Error("boom"));
    await expect(deleteAttributeKey(ORG, "k1")).rejects.toThrow("boom");
  });
});

describe("getMemberAttributeValuesByKey / getMemberAttributes", () => {
  test("groups a member's values by key id in stored order", async () => {
    prisma.memberAttributeValue.findMany.mockResolvedValue([
      { attributeKeyId: "k1", value: "Sweden" },
      { attributeKeyId: "k2", value: "Malmo" },
      { attributeKeyId: "k1", value: "Norway" },
    ] as never);

    expect(await getMemberAttributeValuesByKey(ORG, "user_1")).toEqual(
      new Map([
        ["k1", ["Sweden", "Norway"]],
        ["k2", ["Malmo"]],
      ])
    );
    expect(prisma.memberAttributeValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, userId: "user_1" } })
    );
  });

  test("lists every key with the member's values, empty where none", async () => {
    prisma.memberAttributeKey.findMany.mockResolvedValue([key("k1", "country"), key("k2", "city")] as never);
    prisma.memberAttributeValue.findMany.mockResolvedValue([
      { attributeKeyId: "k1", value: "Sweden" },
    ] as never);

    expect(await getMemberAttributes(ORG, "user_1")).toEqual([
      { keyId: "k1", key: "country", label: "COUNTRY", values: ["Sweden"] },
      { keyId: "k2", key: "city", label: "CITY", values: [] },
    ]);
  });
});

describe("listMembersWithAttributes", () => {
  const membership = {
    userId: "user_1",
    role: "member",
    user: { name: "Anna", email: "anna@example.com" },
    attributeValues: [
      { attributeKeyId: "k1", value: "Sweden" },
      { attributeKeyId: "k_other", value: "ignored" },
    ],
  };

  test("maps memberships to every key with their values", async () => {
    prisma.memberAttributeKey.findMany.mockResolvedValue([key("k1", "country"), key("k2", "city")] as never);
    prisma.membership.findMany.mockResolvedValue([membership] as never);

    expect(await listMembersWithAttributes(ORG, { limit: 10 })).toEqual([
      {
        userId: "user_1",
        name: "Anna",
        email: "anna@example.com",
        role: "member",
        attributes: [
          { keyId: "k1", key: "country", label: "COUNTRY", values: ["Sweden"] },
          { keyId: "k2", key: "city", label: "CITY", values: [] },
        ],
      },
    ]);
    const args = prisma.membership.findMany.mock.calls[0][0];
    expect(args?.where).toEqual({ organizationId: ORG });
    expect(args?.take).toBe(10);
  });

  test("searches name or email and caps the limit", async () => {
    prisma.memberAttributeKey.findMany.mockResolvedValue([]);
    prisma.membership.findMany.mockResolvedValue([]);

    await listMembersWithAttributes(ORG, { search: "  ann ", limit: 1_000_000 });
    const args = prisma.membership.findMany.mock.calls[0][0];
    expect(args?.take).toBe(MEMBER_ATTRIBUTE_LIST_MAX_LIMIT);
    expect(args?.where).toEqual({
      organizationId: ORG,
      user: {
        OR: [
          { name: { contains: "ann", mode: "insensitive" } },
          { email: { contains: "ann", mode: "insensitive" } },
        ],
      },
    });
  });

  test("takes at least one row", async () => {
    prisma.memberAttributeKey.findMany.mockResolvedValue([]);
    prisma.membership.findMany.mockResolvedValue([]);
    await listMembersWithAttributes(ORG, { limit: 0 });
    expect(prisma.membership.findMany.mock.calls[0][0]?.take).toBe(1);
  });
});

describe("listMemberAttributeRows", () => {
  const member = (userId: string) => ({
    userId,
    role: "member",
    user: { name: userId, email: `${userId}@example.com` },
    attributeValues: [
      { attributeKeyId: "k1", value: "Sweden" },
      { attributeKeyId: "k1", value: "Norway" },
      { attributeKeyId: "k_gone", value: "x" },
    ],
  });
  const invite = (id: string) => ({
    id,
    name: null,
    email: `${id}@example.com`,
    role: "member",
    attributeValues: [{ attributeKeyId: "k1", value: "Finland" }],
  });

  beforeEach(() => {
    prisma.memberAttributeKey.findMany.mockResolvedValue([key("k1", "country")] as never);
  });

  test("returns a member cursor when more members remain", async () => {
    prisma.membership.findMany.mockResolvedValue([member("u1"), member("u2"), member("u3")] as never);

    const { rows, nextCursor } = await listMemberAttributeRows(ORG, { limit: 2, cursor: null });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      type: "member",
      userId: "u1",
      name: "u1",
      email: "u1@example.com",
      role: "member",
      attributes: { country: ["Sweden", "Norway"] },
    });
    expect(nextCursor).toEqual({ phase: "member", id: "u2" });
    expect(prisma.invite.findMany).not.toHaveBeenCalled();
  });

  test("moves to invites on the next page when members fill the page exactly", async () => {
    prisma.membership.findMany.mockResolvedValue([member("u1"), member("u2")] as never);

    const result = await listMemberAttributeRows(ORG, { limit: 2, cursor: null });

    expect(result.nextCursor).toEqual({ phase: "invite", id: "" });
    expect(prisma.invite.findMany).not.toHaveBeenCalled();
  });

  test("fills the rest of the page with pending invites and filters by search", async () => {
    prisma.membership.findMany.mockResolvedValue([member("u1")] as never);
    prisma.invite.findMany.mockResolvedValue([invite("i1"), invite("i2"), invite("i3")] as never);

    const { rows, nextCursor } = await listMemberAttributeRows(ORG, {
      limit: 3,
      cursor: { phase: "member", id: "u0" },
      search: " anna ",
    });

    expect(rows.map((row) => row.type)).toEqual(["member", "invite", "invite"]);
    expect(rows[1]).toEqual({
      type: "invite",
      inviteId: "i1",
      name: null,
      email: "i1@example.com",
      role: "member",
      attributes: { country: ["Finland"] },
    });
    expect(nextCursor).toEqual({ phase: "invite", id: "i2" });
    const nameOrEmail = [
      { name: { contains: "anna", mode: "insensitive" } },
      { email: { contains: "anna", mode: "insensitive" } },
    ];
    expect(prisma.membership.findMany.mock.calls[0][0]?.where).toEqual({
      organizationId: ORG,
      userId: { gt: "u0" },
      user: { OR: nameOrEmail },
    });
    expect(prisma.invite.findMany.mock.calls[0][0]?.where).toEqual({
      organizationId: ORG,
      acceptorId: null,
      OR: nameOrEmail,
    });
    expect(prisma.invite.findMany.mock.calls[0][0]?.take).toBe(3);
  });

  test("continues invites after the cursor and ends without one", async () => {
    prisma.invite.findMany.mockResolvedValue([invite("i5")] as never);

    const { rows, nextCursor } = await listMemberAttributeRows(ORG, {
      limit: 5,
      cursor: { phase: "invite", id: "i4" },
    });

    expect(rows).toHaveLength(1);
    expect(nextCursor).toBeNull();
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
    expect(prisma.invite.findMany.mock.calls[0][0]?.where).toEqual({
      organizationId: ORG,
      acceptorId: null,
      id: { gt: "i4" },
    });
  });
});

describe("matchEmailsInOrganization", () => {
  test("returns an empty map without querying for no emails", async () => {
    expect(await matchEmailsInOrganization(ORG, [])).toEqual(new Map());
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("groups invites per email and lets a member win over an invite", async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ userId: "u1", email: "anna@example.com" }] as never)
      .mockResolvedValueOnce([
        { id: "i1", email: "anna@example.com" },
        { id: "i2", email: "ben@example.com" },
        { id: "i3", email: "ben@example.com" },
      ] as never);

    const matches = await matchEmailsInOrganization(ORG, [
      " Anna@Example.com",
      "ben@example.com",
      "BEN@example.com",
    ]);

    expect(matches.get("anna@example.com")).toEqual({
      target: "member",
      userId: "u1",
      email: "anna@example.com",
    });
    expect(matches.get("ben@example.com")).toEqual({
      target: "invite",
      inviteIds: ["i2", "i3"],
      email: "ben@example.com",
    });
    expect(matches.size).toBe(2);
  });
});

describe("applyMemberAttributeWrites", () => {
  test("does nothing when no row names a key", async () => {
    await applyMemberAttributeWrites(ORG, [{ target: "member", userId: "u1", valuesByKeyId: new Map() }]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("replaces the named keys of members and invites, scoped by the organization", async () => {
    await applyMemberAttributeWrites(ORG, [
      { target: "member", userId: "u1", valuesByKeyId: new Map([["k1", ["Sweden"]]]) },
      { target: "invite", inviteId: "i1", valuesByKeyId: new Map([["k1", ["Norway"]]]) },
    ]);

    expect(prisma.memberAttributeValue.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, userId: "u1", attributeKeyId: { in: ["k1"] } },
    });
    expect(prisma.inviteAttributeValue.deleteMany).toHaveBeenCalledWith({
      where: { inviteId: "i1", invite: { organizationId: ORG }, attributeKeyId: { in: ["k1"] } },
    });
    const memberData = prisma.memberAttributeValue.createMany.mock.calls[0][0]?.data;
    expect(memberData).toEqual([
      expect.objectContaining({ organizationId: ORG, userId: "u1", attributeKeyId: "k1", value: "Sweden" }),
    ]);
    const inviteData = prisma.inviteAttributeValue.createMany.mock.calls[0][0]?.data;
    expect(inviteData).toEqual([
      expect.objectContaining({ inviteId: "i1", attributeKeyId: "k1", value: "Norway" }),
    ]);
  });

  test("clears a key given an empty list without inserting", async () => {
    await applyMemberAttributeWrites(ORG, [
      { target: "member", userId: "u1", valuesByKeyId: new Map([["k1", []]]) },
    ]);
    expect(prisma.memberAttributeValue.deleteMany).toHaveBeenCalled();
    expect(prisma.memberAttributeValue.createMany).not.toHaveBeenCalled();
    expect(prisma.inviteAttributeValue.createMany).not.toHaveBeenCalled();
  });
});

describe("invite values", () => {
  test("reads only values whose key belongs to the invite's organization", async () => {
    prisma.inviteAttributeValue.findMany.mockResolvedValue([]);
    await readInviteAttributeValues({ inviteId: "i1", organizationId: ORG });
    expect(prisma.inviteAttributeValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inviteId: "i1", invite: { organizationId: ORG }, attributeKey: { organizationId: ORG } },
      })
    );
  });

  test("copies nothing when the invite holds no values", async () => {
    prisma.inviteAttributeValue.findMany.mockResolvedValue([]);
    expect(
      await copyInviteAttributeValuesToMembership({ inviteId: "i1", organizationId: ORG, userId: "u1" })
    ).toBe(0);
    expect(prisma.memberAttributeValue.createMany).not.toHaveBeenCalled();
  });

  test("copies values read earlier onto the membership", async () => {
    prisma.memberAttributeValue.createMany.mockResolvedValue({ count: 1 });
    const values = [{ attributeKeyId: "k1", value: "Sweden", normalizedValue: "sweden" }];

    expect(
      await copyInviteAttributeValuesToMembership({
        inviteId: "i1",
        organizationId: ORG,
        userId: "u1",
        values,
      })
    ).toBe(1);
    expect(prisma.inviteAttributeValue.findMany).not.toHaveBeenCalled();
    expect(prisma.memberAttributeValue.createMany).toHaveBeenCalledWith({
      data: [{ ...values[0], organizationId: ORG, userId: "u1" }],
      skipDuplicates: true,
    });
  });
});
