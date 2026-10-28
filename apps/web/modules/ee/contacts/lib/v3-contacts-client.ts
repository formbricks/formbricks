import type { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

export type TV3ContactListItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  attributes: { key: string; name: string | null; dataType: TContactAttributeDataType; value: string }[];
};

export type TV3ContactListPage = {
  data: TV3ContactListItem[];
  meta: { limit: number; nextCursor: string | null; totalCount: number | null };
};

export const listContacts = async ({
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
}): Promise<TV3ContactListPage> => {
  const searchParams = new URLSearchParams({ workspaceId, limit: String(limit) });
  for (const [key, value] of params) searchParams.append(key, value);
  // The match count only needs computing for the first page of a filter; the API skips it by default.
  if (cursor) searchParams.set("cursor", cursor);
  else searchParams.set("includeTotalCount", "true");
  const response = await fetch(`/api/v3/contacts?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return (await response.json()) as TV3ContactListPage;
};

/** One attribute's distinct values, bounded on the server — a quick filter's value list. */
export const listContactAttributeValues = async ({
  workspaceId,
  key,
  search,
  limit = 50,
}: {
  workspaceId: string;
  key: string;
  search: string;
  limit?: number;
}): Promise<string[]> => {
  const searchParams = new URLSearchParams({ workspaceId, key, limit: String(limit) });
  if (search) searchParams.set("filter[value][contains]", search);
  const response = await fetch(`/api/v3/contacts/attribute-values?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw await parseV3ApiError(response);
  const body = (await response.json()) as { data: { value: string }[] };
  return body.data.map((item) => item.value);
};
