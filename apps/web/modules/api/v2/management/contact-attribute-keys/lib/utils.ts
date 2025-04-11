import { TGetContactAttributeKeysFilter } from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { Prisma } from "@prisma/client";

export const getContactAttributeKeysQuery = (
  environmentIds: string[],
  params?: TGetContactAttributeKeysFilter
): Prisma.ContactAttributeKeyFindManyArgs => {
  let query: Prisma.ContactAttributeKeyFindManyArgs = {
    where: {
      environmentId: {
        in: environmentIds,
      },
    },
  };

  if (!params) return query;

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.ContactAttributeKeyFindManyArgs>(query, baseFilter);
  }

  return query;
};
