/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */
import { Prisma } from "@prisma/client";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const xmAttributeRemoval: MigrationScript = {
  type: "data",
  id: "mq9x7rjdnq0saxoli9pl9b3o",
  name: "20241209111404_xm_attribute_removal",
  run: async ({ tx }) => {
    // Your migration script goes here
    const emailAttributes: {
      id: string;
      value: string;
      contactId: string;
      environmentId: string;
      contactCreatedAt: Date;
      attributeCreatedAt: Date;
    }[] =
      await tx.$queryRaw`SELECT ca.id, ca.value, c.id AS "contactId", c."environmentId", c.created_at AS "contactCreatedAt", ca.created_at AS "attributeCreatedAt"
       FROM "ContactAttribute" ca
       JOIN "Contact" c ON ca."contactId" = c.id
       JOIN "ContactAttributeKey" ak ON ca."attributeKeyId" = ak.id
       WHERE ak.key = 'email'
       ORDER BY ca.created_at ASC`;

    const emailsByEnvironment: Record<
      string,
      Record<string, { id: string; contactId: string; createdAt: Date }[]>
    > = {};

    for (const attr of emailAttributes) {
      const { environmentId, value: email, id, contactId, attributeCreatedAt } = attr;

      if (!emailsByEnvironment[environmentId]) {
        emailsByEnvironment[environmentId] = {};
      }

      if (!emailsByEnvironment[environmentId][email]) {
        emailsByEnvironment[environmentId][email] = [];
      }

      emailsByEnvironment[environmentId][email].push({
        id,
        contactId,
        createdAt: new Date(attributeCreatedAt),
      });
    }

    const deletionSummary: Record<
      string,
      {
        email: string;
        deletedAttributeIds: string[];
        keptAttributeId: string;
      }[]
    > = {};

    for (const [environmentId, emailGroups] of Object.entries(emailsByEnvironment)) {
      deletionSummary[environmentId] = [];

      for (const [email, attributes] of Object.entries(emailGroups)) {
        if (attributes.length > 1) {
          attributes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          const [kept, ...duplicates] = attributes;
          const duplicateIds = duplicates.map((d) => d.id);

          await tx.$executeRaw`DELETE FROM "ContactAttribute" WHERE id IN (${Prisma.join(duplicateIds)})`;

          deletionSummary[environmentId].push({
            email,
            deletedAttributeIds: duplicateIds,
            keptAttributeId: kept.id,
          });
        }
      }
    }

    const summary = {
      totalDuplicateAttributesRemoved: Object.values(deletionSummary).reduce(
        (acc, env) => acc + env.reduce((sum, item) => sum + item.deletedAttributeIds.length, 0),
        0
      ),
    };

    console.log("Data migration completed. Summary: ", summary);
  },
};
