/** Query keys of the Member attribute client data, per organization. */
export const memberAttributeKeys = {
  all: (organizationId: string) => ["member-attributes", organizationId] as const,
  keys: (organizationId: string) => [...memberAttributeKeys.all(organizationId), "keys"] as const,
  rows: (organizationId: string) => [...memberAttributeKeys.all(organizationId), "rows"] as const,
};
