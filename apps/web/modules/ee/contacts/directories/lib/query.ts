/** Query keys for Organization settings › Contact directories: one list document per organization. */
export const contactDirectoryKeys = {
  all: ["contact-directories"] as const,
  list: (organizationId: string) => [...contactDirectoryKeys.all, "list", organizationId] as const,
};
