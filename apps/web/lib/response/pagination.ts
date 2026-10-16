import { z } from "zod";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";

/** The last response of a batch sorted by `createdAt desc, id desc`; the next batch starts after it. */
export const ZResponseCursor = z.object({ id: ZId, createdAt: z.date() });

export type TResponseCursor = z.infer<typeof ZResponseCursor>;

/**
 * Narrows `where` to the responses after `cursor` in the `createdAt desc, id desc` order the batch
 * loops sort by.
 *
 * Built from the cursor's own values on purpose. An `id < cursor` range only holds while ids and
 * `createdAt` agree, which imported responses keeping their original dates break. Prisma's `cursor`
 * option looks the cursor row up again, so a response deleted between batches ends the loop early.
 * The `lte` bound lets the (surveyId, createdAt, id) index start at the cursor, and the condition is
 * ANDed so it never replaces an id or createdAt condition from the filter.
 *
 * Responses that change while a loop is still reading: a deleted one drops out, a new one sorts
 * before the cursor (its `createdAt` is newer) and is not returned, and a backdated one inserted
 * past the cursor comes back in a later batch. No response is returned twice.
 */
export const whereAfterResponseCursor = (
  where: Prisma.ResponseWhereInput,
  cursor?: TResponseCursor
): Prisma.ResponseWhereInput => {
  if (!cursor) return where;

  return {
    AND: [
      where,
      {
        createdAt: { lte: cursor.createdAt },
        OR: [{ createdAt: { lt: cursor.createdAt } }, { id: { lt: cursor.id } }],
      },
    ],
  };
};
