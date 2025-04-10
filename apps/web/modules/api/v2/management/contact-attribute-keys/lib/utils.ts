import { TGetContactAttributeKeysFilter } from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { Prisma } from "@prisma/client";

export const getContactAttributeKeysQuery = (
  environmentIds: string[],
  params?: TGetContactAttributeKeysFilter
): Prisma.ContactAttributeKeyFindManyArgs => {
  let query = {} satisfies Prisma.ContactAttributeKeyFindManyArgs;

  if (params?.environmentId) {
    if (!environmentIds.includes(params.environmentId)) {
      throw new Error("You are not allowed to access this environment");
    }
    query = {
      ...query,
      where: {
        environmentId: params.environmentId,
      },
    };
  } else {
    query = {
      ...query,
      where: {
        environmentId: {
          in: environmentIds,
        },
      },
    };
  }

  if (!params) return query;

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.ContactAttributeKeyFindManyArgs>(query, baseFilter);
  }

  return query;
};
