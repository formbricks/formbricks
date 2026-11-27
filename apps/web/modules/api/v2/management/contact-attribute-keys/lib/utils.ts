import { Prisma } from "@formbricks/database/prisma";
import { TGetContactAttributeKeysFilter } from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";

/** Every key of the given contact directories, filtered and paged by the common v2 parameters. */
export const getContactAttributeKeysQuery = (
  directoryIds: string[],
  params?: TGetContactAttributeKeysFilter
): Prisma.ContactAttributeKeyFindManyArgs => {
  let query: Prisma.ContactAttributeKeyFindManyArgs = {
    where: { directoryId: { in: directoryIds } },
  };

  if (!params) return query;

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.ContactAttributeKeyFindManyArgs>(query, baseFilter);
  }

  return query;
};
