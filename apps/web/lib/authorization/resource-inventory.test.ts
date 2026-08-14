import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  AUDIT_TARGET_AUTHORIZATION_RESOURCE_INVENTORY,
  PRISMA_AUTHORIZATION_RESOURCE_INVENTORY,
} from "./resource-inventory";

const REPOSITORY_ROOT = new URL("../../../../", import.meta.url).pathname;

const readPrismaModels = (): ReadonlyArray<string> => {
  const schemaDirectory = join(REPOSITORY_ROOT, "packages/database/schema");
  const models = readdirSync(schemaDirectory)
    .filter((file) => file.endsWith(".prisma"))
    .flatMap((file) =>
      [...readFileSync(join(schemaDirectory, file), "utf8").matchAll(/^model\s+(\w+)\s+\{/gm)].map(
        ([, model]) => model
      )
    );

  return [...new Set(models)].sort();
};

const readAuditTargets = (): ReadonlyArray<string> => {
  const source = readFileSync(
    join(REPOSITORY_ROOT, "apps/web/modules/ee/audit-logs/types/audit-log.ts"),
    "utf8"
  );
  const targetBlock = source.match(/ZAuditTarget\s*=\s*z\.enum\(\[([\s\S]*?)\]\)/)?.[1];
  if (!targetBlock) {
    throw new Error("Unable to locate ZAuditTarget");
  }

  return [...targetBlock.matchAll(/"([^"]+)"/g)].map(([, target]) => target).sort();
};

describe("authorization resource inventory", () => {
  test("classifies every Prisma model exactly once", () => {
    expect(Object.keys(PRISMA_AUTHORIZATION_RESOURCE_INVENTORY).sort()).toEqual(readPrismaModels());
  });

  test("classifies every audit target exactly once", () => {
    expect(Object.keys(AUDIT_TARGET_AUTHORIZATION_RESOURCE_INVENTORY).sort()).toEqual(readAuditTargets());
  });

  test("keeps every current grant source in the relationship category", () => {
    for (const source of [
      "Membership",
      "TeamUser",
      "WorkspaceTeam",
      "ApiKey",
      "ApiKeyWorkspace",
      "FeedbackDirectoryWorkspace",
    ] as const) {
      expect(PRISMA_AUTHORIZATION_RESOURCE_INVENTORY[source]).toBe("relationship_or_grant_source");
    }
  });

  test("keeps charts and workflows workspace-inherited rather than standalone Phase 1 ACLs", () => {
    expect(PRISMA_AUTHORIZATION_RESOURCE_INVENTORY.Chart).toBe("workspace_inherited_resource");
    expect(PRISMA_AUTHORIZATION_RESOURCE_INVENTORY.Workflow).toBe("workspace_inherited_resource");
  });
});
