/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */
import type { DataMigrationScript } from "../../types/migration-runner";

export const xmAttributeRemoval: DataMigrationScript = {
  type: "data",
  id: "mq9x7rjdnq0saxoli9pl9b3o",
  name: "xmAttributeRemoval",
  run: async ({ tx }) => {
    // Your migration script goes here
    const emailAttributes = await tx.contactAttribute.findMany({
      where: {
        attributeKey: {
          key: "email",
        },
      },
      select: {
        id: true,
        value: true,
        contact: {
          select: {
            id: true,
            environmentId: true,
            createdAt: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc", // Keep oldest attribute
      },
    });

    // 2. Group by environment and email
    const emailsByEnvironment: Record<
      //  environmentId key
      string,
      // email record
      Record<string, { id: string; contactId: string; createdAt: Date }[]>
    > = {};

    // Group attributes by environment and email
    for (const attr of emailAttributes) {
      const { environmentId } = attr.contact;
      const email = attr.value;

      if (!emailsByEnvironment[environmentId]) {
        emailsByEnvironment[environmentId] = {};
      }

      if (!emailsByEnvironment[environmentId][email]) {
        emailsByEnvironment[environmentId][email] = [];
      }

      emailsByEnvironment[environmentId][email].push({
        id: attr.id,
        contactId: attr.contact.id,
        createdAt: attr.createdAt,
      });
    }

    // 3. Identify and delete duplicates
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
          // Sort by createdAt to ensure we keep the oldest
          attributes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          // Keep the first (oldest) attribute and delete the rest
          const [kept, ...duplicates] = attributes;
          const duplicateIds = duplicates.map((d) => d.id);

          // Delete duplicate attributes
          await tx.contactAttribute.deleteMany({
            where: {
              id: {
                in: duplicateIds,
              },
            },
          });

          deletionSummary[environmentId].push({
            email,
            deletedAttributeIds: duplicateIds,
            keptAttributeId: kept.id,
          });
        }
      }
    }

    // 4. Return summary of what was cleaned up
    const summary = {
      totalDuplicateAttributesRemoved: Object.values(deletionSummary).reduce(
        (acc, env) => acc + env.reduce((sum, item) => sum + item.deletedAttributeIds.length, 0),
        0
      ),
    };

    console.log("Data migration completed. Summary: ", summary);
  },
};
