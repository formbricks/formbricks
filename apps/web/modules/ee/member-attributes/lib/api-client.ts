import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TBulkMemberAttributeRow, TBulkRowOutcome } from "./bulk";
import { MEMBER_ATTRIBUTE_LIST_MAX_LIMIT } from "./limits";

/**
 * Browser client for the v3 Member attribute operations (ENG-7473). The Members page and Organization
 * settings read and write Member attributes only through these, with TanStack Query.
 */

const basePath = (organizationId: string) => `/api/v3/organizations/${encodeURIComponent(organizationId)}`;
const MUTATION_TIMEOUT_MS = 15_000;
const BULK_TIMEOUT_MS = 60_000;

export type TMemberAttributeKeyItem = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  distinctValueCount: number;
};

export type TMemberAttributeKeyResource = Omit<TMemberAttributeKeyItem, "memberCount" | "distinctValueCount">;

export type TMemberAttributeRowItem = {
  type: "member" | "invite";
  userId?: string;
  inviteId?: string;
  name: string | null;
  email: string;
  role: string;
  attributes: Record<string, string[]>;
};

export type TBulkMemberAttributesResult = {
  summary: { updatedMembers: number; updatedInvites: number; unknownEmails: number; invalid: number };
  rows: TBulkRowOutcome[];
};

/** Pages the members' values list walks before it stops, so a client can never loop without end. */
const MAX_PAGES = 40;

const json = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: T }).data;
};

export const listMemberAttributeKeys = async (
  organizationId: string,
  signal?: AbortSignal
): Promise<TMemberAttributeKeyItem[]> =>
  json(await fetch(`${basePath(organizationId)}/member-attribute-keys`, { cache: "no-store", signal }));

export const createMemberAttributeKey = async (
  organizationId: string,
  body: { key: string; label: string; description: string | null }
): Promise<TMemberAttributeKeyResource> =>
  json(
    await fetch(`${basePath(organizationId)}/member-attribute-keys`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    })
  );

export const updateMemberAttributeKey = async (
  organizationId: string,
  keyId: string,
  body: { label: string; description: string | null; expectedUpdatedAt: string }
): Promise<TMemberAttributeKeyResource> =>
  json(
    await fetch(`${basePath(organizationId)}/member-attribute-keys/${encodeURIComponent(keyId)}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    })
  );

export const deleteMemberAttributeKey = async (
  organizationId: string,
  keyId: string,
  expectedUpdatedAt: string
): Promise<void> => {
  const query = new URLSearchParams({ expectedUpdatedAt });
  await json(
    await fetch(
      `${basePath(organizationId)}/member-attribute-keys/${encodeURIComponent(keyId)}?${query.toString()}`,
      { method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS) }
    )
  );
};

/** Every member's and pending invite's values, walking the list's pages (bounded; throws past the bound). */
export const listAllMemberAttributeRows = async (
  organizationId: string,
  signal?: AbortSignal
): Promise<TMemberAttributeRowItem[]> => {
  const rows: TMemberAttributeRowItem[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ limit: String(MEMBER_ATTRIBUTE_LIST_MAX_LIMIT) });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`${basePath(organizationId)}/member-attributes?${query.toString()}`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw await parseV3ApiError(response);
    const body = (await response.json()) as {
      data: TMemberAttributeRowItem[];
      meta: { nextCursor: string | null };
    };
    rows.push(...body.data);
    cursor = body.meta.nextCursor;
    if (!cursor) return rows;
  }
  // A partial list would read as members without values: the table would show them blank, the member
  // list download would export blank cells, and re-importing it would clear their values. Fail instead.
  throw new Error(`Member attributes list exceeds ${MAX_PAGES} pages`);
};

export const bulkSetMemberAttributes = async (
  organizationId: string,
  rows: TBulkMemberAttributeRow[]
): Promise<TBulkMemberAttributesResult> =>
  json(
    await fetch(`${basePath(organizationId)}/member-attributes/bulk`, {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
      signal: AbortSignal.timeout(BULK_TIMEOUT_MS),
    })
  );
