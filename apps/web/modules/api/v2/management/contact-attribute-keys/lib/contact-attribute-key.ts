import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { getContactAttributeKeysQuery } from "@/modules/api/v2/management/contact-attribute-keys/lib/utils";
import { TGetContactAttributeKeysFilter } from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { ContactAttributeKey } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getContactAttributeKeys = reactCache(
  async (environmentIds: string[], params: TGetContactAttributeKeysFilter) =>
    cache(
      async (): Promise<Result<ApiResponseWithMeta<ContactAttributeKey[]>, ApiErrorResponseV2>> => {
        try {
          const query = getContactAttributeKeysQuery(environmentIds, params);

          const [keys, count] = await prisma.$transaction([
            prisma.contactAttributeKey.findMany({
              ...query,
            }),
            prisma.contactAttributeKey.count({
              where: query.where,
            }),
          ]);

          return ok({ data: keys, meta: { total: count, limit: params.limit, offset: params.skip } });
        } catch (error) {
          return err({
            type: "internal_server_error",
            details: [{ field: "contactAttributeKeys", issue: error.message }],
          });
        }
      },
      [`management-getContactAttributeKeys-${environmentIds.join(",")}-${JSON.stringify(params)}`],
      {
        tags: environmentIds.map((environmentId) =>
          contactAttributeKeyCache.tag.byEnvironmentId(environmentId)
        ),
      }
    )()
);
