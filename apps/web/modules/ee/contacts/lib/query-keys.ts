/** TanStack Query keys for the Contacts area's client-fetched lists. */
export const contactQueryKeys = {
  all: ["contacts"] as const,
  contactList: (workspaceId: string, params: readonly (readonly [string, string])[] | null) =>
    [...contactQueryKeys.all, "list", workspaceId, params] as const,
  attributeKeyList: (workspaceId: string, params: readonly (readonly [string, string])[] | null) =>
    [...contactQueryKeys.all, "attribute-keys", workspaceId, params] as const,
  segmentList: (workspaceId: string, params: readonly (readonly [string, string])[] | null) =>
    [...contactQueryKeys.all, "segments", workspaceId, params] as const,
};
