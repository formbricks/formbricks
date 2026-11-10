/** TanStack Query keys for the Contacts area's client-fetched data. */
export const contactQueryKeys = {
  all: ["contacts"] as const,
  contactList: (workspaceId: string, params: readonly (readonly [string, string])[] | null) =>
    [...contactQueryKeys.all, "list", workspaceId, params] as const,
  attributeKeyList: (workspaceId: string, params: readonly (readonly [string, string])[] | null) =>
    [...contactQueryKeys.all, "attribute-keys", workspaceId, params] as const,
  segmentList: (workspaceId: string, params: readonly (readonly [string, string])[] | null) =>
    [...contactQueryKeys.all, "segments", workspaceId, params] as const,
  /** The values an attribute has, for the segment editor's value picker. */
  attributeKeyValues: (contactAttributeKeyId: string) =>
    [...contactQueryKeys.all, "attribute-key-values", contactAttributeKeyId] as const,
  /** The surveys a segment's survey-interaction filter can name, for the segment editor's picker. */
  segmentFilterSurveys: (workspaceId: string) =>
    [...contactQueryKeys.all, "segment-filter-surveys", workspaceId] as const,
};
