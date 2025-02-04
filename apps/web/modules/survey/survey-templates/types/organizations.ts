import { Organization } from "@prisma/client";

export interface TOrganizationAIKeys extends Pick<Organization, "isAIEnabled" | "billing"> {}
