import { z } from "zod";

export enum OrganizationAccessType {
  Read = "read",
  Write = "write",
}

export enum OrganizationAccess {
  AccessControl = "accessControl",
}

const organizationAccessTypeValues = Object.values(OrganizationAccessType);

const organizationAccessTypeShape = organizationAccessTypeValues.reduce<Record<string, z.ZodBoolean>>(
  (acc, enumKey) => {
    acc[enumKey] = z.boolean();
    return acc;
  },
  {}
);

const organizationAccessValues = Object.values(OrganizationAccess);

export const ZOrganizationAccess = z.object(
  organizationAccessValues.reduce<Record<string, z.ZodObject<Record<string, z.ZodBoolean>>>>(
    (acc, access) => {
      acc[access] = z.object(organizationAccessTypeShape).strict();
      return acc;
    },
    {}
  )
);

export type TOrganizationAccess = z.infer<typeof ZOrganizationAccess>;
