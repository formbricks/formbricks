import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import {
  MemberAttributeKeyConflictError,
  MemberAttributeKeyInUseError,
  MemberAttributeKeyLimitError,
  MemberAttributeKeyNotFoundError,
  MemberAttributeKeyTakenError,
} from "./errors";
import {
  MEMBER_ATTRIBUTE_LIST_MAX_LIMIT,
  MEMBER_ATTRIBUTE_MAX_DATASETS_IN_CONFLICT,
  MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION,
} from "./limits";
import { normalizeMemberAttributeValue } from "./values";

/**
 * Member attributes (ENG-7468, GLOSSARY "Member attribute"): an organization-wide list of keys Owners and
 * Managers define, and the values each membership (or pending invite) holds for them, one row per value.
 *
 * Every read and write here is scoped by the organization the caller was authorized for; ids that come
 * from a request (a key id, an email) are only ever resolved inside it. The built-in Email attribute is
 * never stored: it is the login email.
 *
 * Callers own authorization and the plan gate (`app/api/v3/organizations/[organizationId]/member-attributes`).
 */

export type TMemberAttributeKey = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TMemberAttributeKeyWithUsage = TMemberAttributeKey & {
  /** Members holding at least one value for the key (pending invites not counted). */
  memberCount: number;
  /** Distinct values members hold for the key, compared as matching compares them. */
  distinctValueCount: number;
};

const KEY_SELECT = {
  id: true,
  key: true,
  label: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

const isForeignKeyViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";

// ---------------------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------------------

/** The organization's attribute keys, oldest first (bounded by the per-organization key cap). */
export const listAttributeKeys = async (organizationId: string): Promise<TMemberAttributeKey[]> =>
  prisma.memberAttributeKey.findMany({
    where: { organizationId },
    select: KEY_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION,
  });

/** `listAttributeKeys` with how many members hold a value for each key and how many distinct values. */
export const listAttributeKeysWithUsage = async (
  organizationId: string
): Promise<TMemberAttributeKeyWithUsage[]> => {
  const [keys, usage] = await Promise.all([
    listAttributeKeys(organizationId),
    prisma.$queryRaw<Array<{ attributeKeyId: string; memberCount: bigint; distinctValueCount: bigint }>>`
      SELECT "attributeKeyId",
             COUNT(DISTINCT "userId") AS "memberCount",
             COUNT(DISTINCT "normalizedValue") AS "distinctValueCount"
      FROM "MemberAttributeValue"
      WHERE "organizationId" = ${organizationId}
      GROUP BY "attributeKeyId"
    `,
  ]);
  const usageByKey = new Map(usage.map((row) => [row.attributeKeyId, row]));
  return keys.map((key) => ({
    ...key,
    memberCount: Number(usageByKey.get(key.id)?.memberCount ?? 0),
    distinctValueCount: Number(usageByKey.get(key.id)?.distinctValueCount ?? 0),
  }));
};

export const getAttributeKey = async (
  organizationId: string,
  keyId: string
): Promise<TMemberAttributeKey | null> =>
  prisma.memberAttributeKey.findFirst({ where: { id: keyId, organizationId }, select: KEY_SELECT });

/**
 * Creates a key. The per-organization cap is checked in the same transaction as the insert, under a lock
 * on the organization row, so two concurrent creates cannot both pass it.
 */
export const createAttributeKey = async (
  organizationId: string,
  input: { key: string; label: string; description: string | null }
): Promise<TMemberAttributeKey> => {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
      const count = await tx.memberAttributeKey.count({ where: { organizationId } });
      if (count >= MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION) {
        throw new MemberAttributeKeyLimitError(MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION);
      }
      return tx.memberAttributeKey.create({
        data: {
          organizationId,
          key: input.key,
          label: input.label,
          description: input.description,
        },
        select: KEY_SELECT,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new MemberAttributeKeyTakenError(input.key);
    throw error;
  }
};

/**
 * Changes a key's label or description; the `key` itself never changes. A compare-and-set on
 * `updatedAt`: a key changed since `expectedUpdatedAt` is refused with its current `updatedAt`.
 * Returns the key before and after, for the audit log.
 */
export const updateAttributeKey = async (
  organizationId: string,
  keyId: string,
  input: { label?: string; description?: string | null; expectedUpdatedAt: Date }
): Promise<{ before: TMemberAttributeKey; after: TMemberAttributeKey }> =>
  prisma.$transaction(async (tx) => {
    const before = await tx.memberAttributeKey.findFirst({
      where: { id: keyId, organizationId },
      select: KEY_SELECT,
    });
    if (!before) throw new MemberAttributeKeyNotFoundError();

    const { count } = await tx.memberAttributeKey.updateMany({
      where: { id: keyId, organizationId, updatedAt: input.expectedUpdatedAt },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
    if (count === 0) throw new MemberAttributeKeyConflictError(before.updatedAt);

    const after = await tx.memberAttributeKey.findFirstOrThrow({
      where: { id: keyId, organizationId },
      select: KEY_SELECT,
    });
    return { before, after };
  });

const findDatasetsUsingKey = async (
  client: Pick<typeof prisma, "feedbackDirectory">,
  organizationId: string,
  keyId: string
): Promise<{ datasets: { id: string; name: string }[]; datasetCount: number }> => {
  const where = { organizationId, viewerAccessConditions: { some: { attributeKeyId: keyId } } };
  const [datasets, datasetCount] = await Promise.all([
    client.feedbackDirectory.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: MEMBER_ATTRIBUTE_MAX_DATASETS_IN_CONFLICT,
    }),
    client.feedbackDirectory.count({ where }),
  ]);
  return { datasets, datasetCount };
};

/**
 * Deletes a key and every value members and invites hold for it. Refused while Dashboard Viewer access of
 * a Feedback Dataset matches on it (the FK is `Restrict`, so a condition added during the delete is caught
 * by the database too). `expectedUpdatedAt`, when sent, is the same compare-and-set as an update.
 */
export const deleteAttributeKey = async (
  organizationId: string,
  keyId: string,
  expectedUpdatedAt?: Date
): Promise<TMemberAttributeKey> => {
  try {
    return await prisma.$transaction(async (tx) => {
      const key = await tx.memberAttributeKey.findFirst({
        where: { id: keyId, organizationId },
        select: KEY_SELECT,
      });
      if (!key) throw new MemberAttributeKeyNotFoundError();
      if (expectedUpdatedAt && key.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new MemberAttributeKeyConflictError(key.updatedAt);
      }

      const usage = await findDatasetsUsingKey(tx, organizationId, keyId);
      if (usage.datasetCount > 0) throw new MemberAttributeKeyInUseError(usage.datasets, usage.datasetCount);

      await tx.memberAttributeKey.delete({ where: { id: keyId } });
      return key;
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      const usage = await findDatasetsUsingKey(prisma, organizationId, keyId);
      throw new MemberAttributeKeyInUseError(usage.datasets, usage.datasetCount);
    }
    throw error;
  }
};

// ---------------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------------

/**
 * A member's values, keyed by attribute key id, for Dashboard Viewer access (ENG-7476) and View as.
 * A key the member holds no value for is absent. Values are as stored (trimmed, first spelling).
 */
export const getMemberAttributeValuesByKey = async (
  organizationId: string,
  userId: string
): Promise<Map<string, string[]>> => {
  const rows = await prisma.memberAttributeValue.findMany({
    where: { organizationId, userId },
    select: { attributeKeyId: true, value: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION * 50,
  });
  const byKey = new Map<string, string[]>();
  for (const row of rows) {
    const values = byKey.get(row.attributeKeyId) ?? [];
    values.push(row.value);
    byKey.set(row.attributeKeyId, values);
  }
  return byKey;
};

export type TMemberAttributeEntry = { keyId: string; key: string; label: string; values: string[] };

/** Every key of the organization with the member's values for it (empty when they hold none). */
export const getMemberAttributes = async (
  organizationId: string,
  userId: string
): Promise<TMemberAttributeEntry[]> => {
  const [keys, values] = await Promise.all([
    listAttributeKeys(organizationId),
    getMemberAttributeValuesByKey(organizationId, userId),
  ]);
  return keys.map((key) => ({
    keyId: key.id,
    key: key.key,
    label: key.label,
    values: values.get(key.id) ?? [],
  }));
};

export type TMemberWithAttributes = {
  userId: string;
  name: string;
  email: string;
  role: TOrganizationRole;
  attributes: TMemberAttributeEntry[];
};

/**
 * Members with every attribute key and their values, by name then id. Bounded by `limit` (capped at the
 * list maximum); `search` matches name or email, ignoring case.
 */
export const listMembersWithAttributes = async (
  organizationId: string,
  { search, limit }: { search?: string; limit: number }
): Promise<TMemberWithAttributes[]> => {
  const take = Math.max(1, Math.min(limit, MEMBER_ATTRIBUTE_LIST_MAX_LIMIT));
  const term = search?.trim();
  const [keys, memberships] = await Promise.all([
    listAttributeKeys(organizationId),
    prisma.membership.findMany({
      where: {
        organizationId,
        ...(term && {
          user: {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          },
        }),
      },
      select: {
        userId: true,
        role: true,
        user: { select: { name: true, email: true } },
        attributeValues: {
          select: { attributeKeyId: true, value: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ user: { name: "asc" } }, { userId: "asc" }],
      take,
    }),
  ]);

  return memberships.map((membership) => ({
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    attributes: keys.map((key) => ({
      keyId: key.id,
      key: key.key,
      label: key.label,
      values: membership.attributeValues
        .filter((value) => value.attributeKeyId === key.id)
        .map((value) => value.value),
    })),
  }));
};

export type TMemberAttributeRow =
  | {
      type: "member";
      userId: string;
      name: string;
      email: string;
      role: TOrganizationRole;
      attributes: Record<string, string[]>;
    }
  | {
      type: "invite";
      inviteId: string;
      name: string | null;
      email: string;
      role: TOrganizationRole;
      attributes: Record<string, string[]>;
    };

export type TMemberAttributeRowsCursor = { phase: "member" | "invite"; id: string };

const toAttributeRecord = (
  keyById: Map<string, string>,
  values: { attributeKeyId: string; value: string }[]
): Record<string, string[]> => {
  const record: Record<string, string[]> = {};
  for (const { attributeKeyId, value } of values) {
    const key = keyById.get(attributeKeyId);
    if (!key) continue;
    record[key] ??= [];
    record[key].push(value);
  }
  return record;
};

/**
 * One page of members' values for the v3 list: every member first (by user id), then every pending
 * invite (by invite id), each with its values keyed by attribute `key`. Keyset-paginated across both
 * phases: the cursor names the phase and the last id. `search` matches name or email, ignoring case.
 */
export const listMemberAttributeRows = async (
  organizationId: string,
  { limit, cursor, search }: { limit: number; cursor: TMemberAttributeRowsCursor | null; search?: string }
): Promise<{ rows: TMemberAttributeRow[]; nextCursor: TMemberAttributeRowsCursor | null }> => {
  const keys = await listAttributeKeys(organizationId);
  const keyById = new Map(keys.map((key) => [key.id, key.key]));
  const term = search?.trim();
  const nameOrEmail = term
    ? [
        { name: { contains: term, mode: "insensitive" as const } },
        { email: { contains: term, mode: "insensitive" as const } },
      ]
    : undefined;
  const rows: TMemberAttributeRow[] = [];
  const valueSelect = {
    select: { attributeKeyId: true, value: true },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  };

  if (!cursor || cursor.phase === "member") {
    const memberships = await prisma.membership.findMany({
      where: {
        organizationId,
        ...(cursor && { userId: { gt: cursor.id } }),
        ...(nameOrEmail && { user: { OR: nameOrEmail } }),
      },
      select: {
        userId: true,
        role: true,
        user: { select: { name: true, email: true } },
        attributeValues: valueSelect,
      },
      orderBy: { userId: "asc" },
      take: limit + 1,
    });
    for (const membership of memberships.slice(0, limit)) {
      rows.push({
        type: "member",
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        attributes: toAttributeRecord(keyById, membership.attributeValues),
      });
    }
    if (memberships.length > limit) {
      return { rows, nextCursor: { phase: "member", id: memberships[limit - 1].userId } };
    }
  }

  const remaining = limit - rows.length;
  if (remaining <= 0) {
    // The members filled the page exactly; the invites start on the next one.
    return { rows, nextCursor: { phase: "invite", id: "" } };
  }

  const invites = await prisma.invite.findMany({
    where: {
      organizationId,
      acceptorId: null,
      ...(cursor?.phase === "invite" && cursor.id && { id: { gt: cursor.id } }),
      ...(nameOrEmail && { OR: nameOrEmail }),
    },
    select: { id: true, name: true, email: true, role: true, attributeValues: valueSelect },
    orderBy: { id: "asc" },
    take: remaining + 1,
  });
  for (const invite of invites.slice(0, remaining)) {
    rows.push({
      type: "invite",
      inviteId: invite.id,
      name: invite.name,
      email: invite.email,
      role: invite.role,
      attributes: toAttributeRecord(keyById, invite.attributeValues),
    });
  }
  const last = rows.at(-1);
  return {
    rows,
    nextCursor:
      invites.length > remaining && last?.type === "invite" ? { phase: "invite", id: last.inviteId } : null,
  };
};

// ---------------------------------------------------------------------------------------------------
// Bulk writes
// ---------------------------------------------------------------------------------------------------

/** One row to apply: values per key id, already prepared (`prepareMemberAttributeValues`). */
export type TMemberAttributeWrite = { valuesByKeyId: Map<string, string[]> } & (
  | { target: "member"; userId: string }
  | { target: "invite"; inviteId: string }
);

export type TEmailMatch =
  | { target: "member"; userId: string; email: string }
  | { target: "invite"; inviteIds: string[]; email: string };

/**
 * Who each email names in the organization, ignoring case and surrounding spaces: a member when one has
 * that login email, otherwise the pending invites to it. Emails that name neither are absent.
 */
export const matchEmailsInOrganization = async (
  organizationId: string,
  emails: readonly string[]
): Promise<Map<string, TEmailMatch>> => {
  const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
  if (normalized.length === 0) return new Map();

  const [members, invites] = await Promise.all([
    prisma.$queryRaw<Array<{ userId: string; email: string }>>`
      SELECT m."userId", lower(u."email") AS "email"
      FROM "Membership" m
      JOIN "User" u ON u."id" = m."userId"
      WHERE m."organizationId" = ${organizationId}
        AND lower(u."email") = ANY(${normalized}::TEXT[])
    `,
    prisma.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT "id", lower("email") AS "email"
      FROM "Invite"
      WHERE "organizationId" = ${organizationId}
        AND "acceptorId" IS NULL
        AND lower("email") = ANY(${normalized}::TEXT[])
    `,
  ]);

  const matches = new Map<string, TEmailMatch>();
  for (const invite of invites) {
    const existing = matches.get(invite.email);
    if (existing?.target === "invite") existing.inviteIds.push(invite.id);
    else matches.set(invite.email, { target: "invite", inviteIds: [invite.id], email: invite.email });
  }
  // A member wins over an invite to the same address.
  for (const member of members) {
    matches.set(member.email, { target: "member", userId: member.userId, email: member.email });
  }
  return matches;
};

type TMemberValueRow = {
  organizationId: string;
  userId: string;
  attributeKeyId: string;
  value: string;
  normalizedValue: string;
};
type TInviteValueRow = { inviteId: string; attributeKeyId: string; value: string; normalizedValue: string };

const toValueRows = (valuesByKeyId: Map<string, string[]>) =>
  [...valuesByKeyId].flatMap(([attributeKeyId, values]) =>
    values.map((value) => ({ attributeKeyId, value, normalizedValue: normalizeMemberAttributeValue(value) }))
  );

/**
 * Replaces, for each row, the values of the keys it names (a key not named is left alone; an empty list
 * clears the key). All rows in one transaction: the whole batch applies or none of it. Every key id must
 * belong to `organizationId`, and every member and invite id must have come from
 * `matchEmailsInOrganization` for it — the caller resolves them; this re-scopes every delete by the
 * organization as well.
 */
export const applyMemberAttributeWrites = async (
  organizationId: string,
  writes: readonly TMemberAttributeWrite[]
): Promise<void> => {
  const named = writes.filter((write) => write.valuesByKeyId.size > 0);
  if (named.length === 0) return;

  await prisma.$transaction(
    async (tx) => {
      const memberRows: TMemberValueRow[] = [];
      const inviteRows: TInviteValueRow[] = [];

      for (const write of named) {
        const attributeKeyId = { in: [...write.valuesByKeyId.keys()] };
        if (write.target === "member") {
          await tx.memberAttributeValue.deleteMany({
            where: { organizationId, userId: write.userId, attributeKeyId },
          });
          memberRows.push(
            ...toValueRows(write.valuesByKeyId).map((row) => ({
              ...row,
              organizationId,
              userId: write.userId,
            }))
          );
        } else {
          await tx.inviteAttributeValue.deleteMany({
            where: { inviteId: write.inviteId, invite: { organizationId }, attributeKeyId },
          });
          inviteRows.push(
            ...toValueRows(write.valuesByKeyId).map((row) => ({ ...row, inviteId: write.inviteId }))
          );
        }
      }

      if (memberRows.length > 0) {
        await tx.memberAttributeValue.createMany({ data: memberRows, skipDuplicates: true });
      }
      if (inviteRows.length > 0) {
        await tx.inviteAttributeValue.createMany({ data: inviteRows, skipDuplicates: true });
      }
    },
    { timeout: 30_000 }
  );
};

type TInviteAttributeValueRow = { attributeKeyId: string; value: string; normalizedValue: string };

/**
 * An invite's values, as `copyInviteAttributeValuesToMembership` copies them. Keys of another organization
 * are never read: only values whose key belongs to the invite's organization. A caller that spends the
 * invite before the membership exists (deleting the invite deletes its values) reads them first, in the
 * same transaction, and passes them on.
 */
export const readInviteAttributeValues = (
  { inviteId, organizationId }: { inviteId: string; organizationId: string },
  client: Prisma.TransactionClient = prisma
): Promise<TInviteAttributeValueRow[]> =>
  client.inviteAttributeValue.findMany({
    where: { inviteId, invite: { organizationId }, attributeKey: { organizationId } },
    select: { attributeKeyId: true, value: true, normalizedValue: true },
  });

/**
 * Copies an invite's values onto the membership its acceptance created (ENG-7468: "Invites carry values
 * too, copied onto the membership when the person accepts"). Called on every acceptance path after the
 * membership exists. The values are read here unless the caller read them already (`values`), as it must
 * when the invite is deleted (which deletes its values) before the membership exists. `transaction` runs
 * the read and the write inside the caller's transaction.
 */
export const copyInviteAttributeValuesToMembership = async ({
  inviteId,
  organizationId,
  userId,
  values,
  transaction,
}: {
  inviteId: string;
  organizationId: string;
  userId: string;
  values?: TInviteAttributeValueRow[];
  transaction?: Prisma.TransactionClient;
}): Promise<number> => {
  const client = transaction ?? prisma;
  const rows = values ?? (await readInviteAttributeValues({ inviteId, organizationId }, client));
  if (rows.length === 0) return 0;

  const { count } = await client.memberAttributeValue.createMany({
    data: rows.map((value) => ({ ...value, organizationId, userId })),
    skipDuplicates: true,
  });
  return count;
};
