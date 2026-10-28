import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { buildKeysetPage } from "@/app/api/v3/lib/keyset-cursor";
import type { TKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";

/** What every contact read selects: the row, plus each attribute's typed columns and key. */
export const contactSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  workspaceId: true,
  attributes: {
    select: {
      value: true,
      valueNumber: true,
      valueDate: true,
      attributeKey: { select: { key: true, name: true, dataType: true } },
    },
  },
} satisfies Prisma.ContactSelect;

export type TContactRow = Prisma.ContactGetPayload<{ select: typeof contactSelect }>;

export type TContactFilters = {
  workspaceId: string;
  userId?: string;
  attributeKey?: string;
  attributeValue?: string;
};

/** Contacts holding `value` for the attribute `key`, within the workspace the key belongs to. */
const hasAttribute = (workspaceId: string, key: string, value: string): Prisma.ContactWhereInput => ({
  attributes: { some: { attributeKey: { key, workspaceId }, value } },
});

/**
 * The tenant scope plus the caller's filters. `workspaceId` is always the first condition and is never
 * derived from a filter value, so no filter can widen the query beyond the workspace.
 */
export const buildContactWhere = ({
  workspaceId,
  userId,
  attributeKey,
  attributeValue,
}: TContactFilters): Prisma.ContactWhereInput => {
  const conditions: Prisma.ContactWhereInput[] = [];
  if (userId !== undefined) conditions.push(hasAttribute(workspaceId, "userId", userId));
  if (attributeKey !== undefined && attributeValue !== undefined) {
    conditions.push(hasAttribute(workspaceId, attributeKey, attributeValue));
  }

  return { workspaceId, ...(conditions.length > 0 ? { AND: conditions } : {}) };
};

/** Newest first, ties broken by id, so the order is total and a page boundary never splits a tie. */
export const CONTACT_LIST_SORT = "-createdAt";
export const CONTACT_LIST_KIND = "contacts.list";

const afterCursor = (cursor: Pick<TKeysetCursor, "value" | "id">): Prisma.ContactWhereInput => {
  const createdAt = new Date(cursor.value);
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }] };
};

export async function listContactRows(params: {
  filters: TContactFilters;
  limit: number;
  cursor: Pick<TKeysetCursor, "value" | "id"> | null;
  fingerprint: string;
}) {
  const { filters, limit, cursor, fingerprint } = params;
  const where = buildContactWhere(filters);

  // One extra row tells whether another page exists without a second count query.
  const rows = await prisma.contact.findMany({
    where: cursor ? { AND: [where, afterCursor(cursor)] } : where,
    select: contactSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  return buildKeysetPage({
    rows,
    limit,
    kind: CONTACT_LIST_KIND,
    sortBy: CONTACT_LIST_SORT,
    fp: fingerprint,
    sortValue: (row) => row.createdAt,
  });
}

export const countContactRows = (filters: TContactFilters): Promise<number> =>
  prisma.contact.count({ where: buildContactWhere(filters) });

/** Unscoped by design: the caller resolves the workspace from the row and authorizes against it. */
export const getContactRow = (contactId: string): Promise<TContactRow | null> =>
  prisma.contact.findUnique({ where: { id: contactId }, select: contactSelect });

export const findContactIdByUserId = async (workspaceId: string, userId: string): Promise<string | null> => {
  const contact = await prisma.contact.findFirst({
    where: buildContactWhere({ workspaceId, userId }),
    select: { id: true },
  });
  return contact?.id ?? null;
};

/**
 * A new contact carrying only its userId, the way an SDK identify creates one. The rest of the attributes
 * go through `updateAttributes`, which owns type checks, uniqueness and implicit key creation. The
 * `userId` key is one of the workspace's default keys, so connecting to it never creates a key.
 */
export const createContactWithUserId = (workspaceId: string, userId: string): Promise<{ id: string }> =>
  prisma.contact.create({
    data: {
      workspace: { connect: { id: workspaceId } },
      attributes: {
        create: [
          { attributeKey: { connect: { key_workspaceId: { key: "userId", workspaceId } } }, value: userId },
        ],
      },
    },
    select: { id: true },
  });

/** Removes the named attributes from one contact, within the contact's own workspace. */
export const removeContactAttributes = (contactId: string, workspaceId: string, keys: string[]) =>
  prisma.contactAttribute.deleteMany({
    where: { contactId, attributeKey: { workspaceId, key: { in: keys } } },
  });
