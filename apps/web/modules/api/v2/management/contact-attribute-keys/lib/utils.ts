import { Prisma } from "@formbricks/database/prisma";
import { TGetContactAttributeKeysFilter } from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { whereAttributeKeysOfWorkspaces } from "@/modules/ee/contacts/lib/attribute-key-scope";

export const getContactAttributeKeysQuery = (
  workspaceIds: string[],
  params?: TGetContactAttributeKeysFilter
): Prisma.ContactAttributeKeyFindManyArgs => {
  let query: Prisma.ContactAttributeKeyFindManyArgs = {
    where: whereAttributeKeysOfWorkspaces(workspaceIds),
  };

  if (!params) return query;

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.ContactAttributeKeyFindManyArgs>(query, baseFilter);
  }

  return query;
};
