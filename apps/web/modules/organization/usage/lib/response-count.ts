import "server-only";
import { prisma } from "@formbricks/database";

/**
 * Responses the organization collected in a `createdAt` window. `Response` has no organization column,
 * so the scope goes through survey → workspace — one implementation behind both monthly usage counters.
 */
export const countOrganizationResponses = (
  organizationId: string,
  createdAt: { gte?: Date; lt?: Date; lte?: Date }
): Promise<number> =>
  prisma.response.count({ where: { survey: { workspace: { organizationId } }, createdAt } });
