import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

const CHUNK_SIZE = 5000;

/**
 * ENG-7491: every workspace gets a contact directory of its own, even one with no contacts: its SDK may
 * already be installed, and its first `setUserId` must keep working. The directory has no name (the app
 * shows the workspace's) and matching key `email`, and takes over the workspace's attribute keys and its
 * segments, public and private. Contacts follow in the next migration, in batches.
 *
 * In this order, in the runner's transaction: directories, then attribute keys, then segments. No row
 * locks: the previous release never writes `contactDirectoryId` or `directoryId`, and a row it inserts
 * meanwhile gets its directory from the schema step's trigger (or, inserted before this commits, from the
 * sweep at the end of the contact backfill). Each step only touches rows that still have no directory, so
 * a rerun converges and an empty database is a no-op.
 *
 * Directory ids are cuids made here, like the app's: the API validates ids as cuid2.
 */
export const createContactDirectories: MigrationScript = {
  type: "data",
  id: "skiqsh3koz5vm79gh86lppt5",
  name: "20261123120001_create_contact_directories",
  run: async ({ tx }) => {
    const workspaces = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Workspace" WHERE "contactDirectoryId" IS NULL ORDER BY "id"
    `;

    let directoriesCreated = 0;
    for (let start = 0; start < workspaces.length; start += CHUNK_SIZE) {
      const workspaceIds = workspaces.slice(start, start + CHUNK_SIZE).map(({ id }) => id);
      const directoryIds = workspaceIds.map(() => createId());
      directoriesCreated += await tx.$executeRaw`
        WITH input AS (
          SELECT * FROM unnest(${directoryIds}::TEXT[], ${workspaceIds}::TEXT[]) AS i("directoryId", "workspaceId")
        ),
        target AS (
          SELECT i."directoryId", w."id" AS "workspaceId", w."organizationId"
          FROM input i JOIN "Workspace" w ON w."id" = i."workspaceId"
          WHERE w."contactDirectoryId" IS NULL
        ),
        created AS (
          INSERT INTO "ContactDirectory" ("id", "created_at", "updated_at", "name", "matchingKey", "organizationId")
          SELECT "directoryId", now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC', NULL, 'email', "organizationId"
          FROM target
        )
        UPDATE "Workspace" w SET "contactDirectoryId" = target."directoryId"
        FROM target WHERE w."id" = target."workspaceId"
      `;
    }

    const attributeKeysMoved = await tx.$executeRaw`
      UPDATE "ContactAttributeKey" k SET "directoryId" = w."contactDirectoryId"
      FROM "Workspace" w
      WHERE w."id" = k."workspaceId" AND k."directoryId" IS NULL AND w."contactDirectoryId" IS NOT NULL
    `;

    const segmentsMoved = await tx.$executeRaw`
      UPDATE "Segment" s SET "directoryId" = w."contactDirectoryId"
      FROM "Workspace" w
      WHERE w."id" = s."workspaceId" AND s."directoryId" IS NULL AND w."contactDirectoryId" IS NOT NULL
    `;

    logger.info(
      { directoriesCreated, attributeKeysMoved, segmentsMoved },
      "Contact directories: one per workspace created"
    );
  },
};
