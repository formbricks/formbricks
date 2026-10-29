import type {
  TContactAttributeDataType,
  TContactAttributeKey,
  TContactAttributeKeyType,
} from "@formbricks/types/contact-attribute-key";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

type TV3AttributeKeyItem = {
  id: string;
  key: string;
  name: string | null;
  description: string | null;
  type: TContactAttributeKeyType;
  dataType: TContactAttributeDataType;
  isUnique: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TAttributeKeyListPage = {
  data: TContactAttributeKey[];
  meta: { limit: number; nextCursor: string | null; totalCount: number | null };
};

export const listAttributeKeys = async ({
  workspaceId,
  limit,
  cursor,
  params,
  signal,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  params: readonly [string, string][];
  signal?: AbortSignal;
}): Promise<TAttributeKeyListPage> => {
  const searchParams = new URLSearchParams({ workspaceId, limit: String(limit) });
  for (const [key, value] of params) searchParams.append(key, value);
  if (cursor) {
    searchParams.set("cursor", cursor);
  } else {
    // The match count is only needed once per filter, for the first page.
    searchParams.set("includeTotalCount", "true");
  }
  const response = await fetch(`/api/v3/contact-attribute-keys?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  const body = (await response.json()) as {
    data: TV3AttributeKeyItem[];
    meta: TAttributeKeyListPage["meta"];
  };
  return {
    data: body.data.map((item) => ({
      ...item,
      workspaceId,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
    meta: body.meta,
  };
};
