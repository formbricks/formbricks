import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

const CHUNK_SIZE = 5000;

/** `CONTACT_DIRECTORY_NAME_MAX_LENGTH` in apps/web: the longest name the app accepts, in UTF-16 units. */
const NAME_MAX_LENGTH = 100;

/** `name` may be read cut, but always past the limit when the full name is. */
type TWorkspaceRow = { id: string; organizationId: string; name: string };

/** Cuts a name to at most `max` UTF-16 units, never through a surrogate pair, and trims it. */
const cutName = (name: string, max: number): string => {
  let cut = "";
  for (const char of name) {
    if (cut.length + char.length > max) break;
    cut += char;
  }
  return cut.trim();
};

/**
 * Each directory is named after its workspace, cut to the app's limit. Workspace names are unique per
 * organization and directory names must be too, so only a cut can clash: names that fit come first and
 * keep their workspace's name, and a cut name already taken gets " (2)", " (3)"…, in workspace id order.
 * `taken` holds each organization's existing directory names, so a rerun never clashes with them.
 */
export const nameDirectories = (
  workspaces: TWorkspaceRow[],
  taken: Map<string, Set<string>>
): Map<string, string> => {
  const candidates = workspaces.map((workspace) => {
    const base = cutName(workspace.name, NAME_MAX_LENGTH) || workspace.id;
    return { ...workspace, base, cut: base !== workspace.name };
  });
  candidates.sort((a, b) => Number(a.cut) - Number(b.cut) || (a.id < b.id ? -1 : 1));

  const names = new Map<string, string>();
  for (const { id, organizationId, base } of candidates) {
    const takenInOrg = taken.get(organizationId) ?? new Set<string>();
    taken.set(organizationId, takenInOrg);
    let name = base;
    for (let n = 2; takenInOrg.has(name); n++) {
      const suffix = ` (${n})`;
      name = cutName(base, NAME_MAX_LENGTH - suffix.length) + suffix;
    }
    takenInOrg.add(name);
    names.set(id, name);
  }
  return names;
};

/**
 * ENG-7491: every workspace gets a contact directory of its own, even one with no contacts: its SDK may
 * already be installed, and its first `setUserId` must keep working. The directory is named after the
 * workspace (`nameDirectories`) with matching key `email`, and takes over the workspace's attribute keys and
 * its segments, public and private. Contacts follow in the next migration, in batches.
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
    // A workspace name has no length limit. One character past the limit is enough to tell a cut name.
    const workspaces = await tx.$queryRaw<TWorkspaceRow[]>`
      SELECT "id", "organizationId", left("name", ${NAME_MAX_LENGTH + 1}::INT) AS "name"
      FROM "Workspace" WHERE "contactDirectoryId" IS NULL ORDER BY "id"
    `;
    const organizationIds = [...new Set(workspaces.map(({ organizationId }) => organizationId))];
    const existing =
      organizationIds.length === 0
        ? []
        : await tx.$queryRaw<{ organizationId: string; name: string }[]>`
            SELECT "organizationId", "name" FROM "ContactDirectory"
            WHERE "organizationId" = ANY(${organizationIds}::TEXT[])
          `;
    const taken = new Map<string, Set<string>>();
    for (const { organizationId, name } of existing) {
      taken.set(organizationId, (taken.get(organizationId) ?? new Set<string>()).add(name));
    }
    const names = nameDirectories(workspaces, taken);

    let directoriesCreated = 0;
    for (let start = 0; start < workspaces.length; start += CHUNK_SIZE) {
      const workspaceIds = workspaces.slice(start, start + CHUNK_SIZE).map(({ id }) => id);
      const directoryIds = workspaceIds.map(() => createId());
      const directoryNames = workspaceIds.map((id) => names.get(id)!);
      directoriesCreated += await tx.$executeRaw`
        WITH input AS (
          SELECT * FROM unnest(${directoryIds}::TEXT[], ${workspaceIds}::TEXT[], ${directoryNames}::TEXT[])
            AS i("directoryId", "workspaceId", "name")
        ),
        target AS (
          SELECT i."directoryId", i."name", w."id" AS "workspaceId", w."organizationId"
          FROM input i JOIN "Workspace" w ON w."id" = i."workspaceId"
          WHERE w."contactDirectoryId" IS NULL
        ),
        created AS (
          INSERT INTO "ContactDirectory" ("id", "created_at", "updated_at", "name", "matchingKey", "organizationId")
          SELECT "directoryId", now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC', "name", 'email', "organizationId"
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
