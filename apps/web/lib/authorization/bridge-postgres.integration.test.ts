import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { PrismaClient } from "@formbricks/database/prisma";
import { createPrismaPgAdapter } from "@formbricks/database/prisma-adapter";
import { getAuthzedClient } from "@/lib/authzed/client";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { can } from "./index";
import { lookupAuthorizedOrganizationIds, lookupAuthorizedWorkspaceIds } from "./resource-list";

const db = vi.hoisted(() => ({ client: undefined as PrismaClient | undefined }));
vi.mock("@formbricks/database", () => ({
  get prisma() {
    if (!db.client) throw new Error("Bridge test database not started");
    return db.client;
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => ({ USER_MANAGEMENT_MINIMUM_ROLE: "manager" }));
vi.mock("./context", () => ({
  getAuthorizationSurface: () => "unscoped",
  recordAuthorizationCheckIssued: vi.fn(),
}));
vi.mock("./metrics", () => ({ recordAuthorizationDecision: vi.fn() }));
vi.mock("@/lib/authzed/client", () => ({
  getAuthzedClient: vi.fn(() => {
    throw new Error("SDK unavailable");
  }),
}));
vi.mock("@/lib/authzed/outbox-freshness", () => ({
  assertAuthzedProjectionFreshness: vi.fn(() => {
    throw new Error("projection stale");
  }),
}));

const name = `formbricks-bridge-test-${randomUUID()}`;
const user = (id: string) => ({ type: "user", id }) as const;
const key = (id: string) => ({ type: "apiKey", id }) as const;

// Minimal rc.5 authorization tables/columns, using the real generated client and PostgreSQL enums.
// This proves the queries and guards, not full database migration or product-release compatibility.
const fixture = `
CREATE TYPE "OrganizationRole" AS ENUM ('owner','manager','member','billing');
CREATE TYPE "TeamUserRole" AS ENUM ('admin','contributor');
CREATE TYPE "WorkspaceTeamPermission" AS ENUM ('read','readWrite','manage');
CREATE TYPE "ApiKeyPermission" AS ENUM ('read','write','manage');
CREATE TABLE "Organization" (id text PRIMARY KEY);
CREATE TABLE "User" (id text PRIMARY KEY, "isActive" boolean NOT NULL);
CREATE TABLE "Membership" ("organizationId" text, "userId" text, role "OrganizationRole", PRIMARY KEY ("userId","organizationId"));
CREATE TABLE "Workspace" (id text PRIMARY KEY, "organizationId" text, name text);
CREATE TABLE "Team" (id text PRIMARY KEY, "organizationId" text);
CREATE TABLE "TeamUser" ("teamId" text, "userId" text, role "TeamUserRole", PRIMARY KEY ("teamId","userId"));
CREATE TABLE "WorkspaceTeam" ("workspaceId" text, "teamId" text, permission "WorkspaceTeamPermission", PRIMARY KEY ("workspaceId","teamId"));
CREATE TABLE "ApiKey" (id text PRIMARY KEY, "organizationId" text, "organizationAccess" jsonb);
CREATE TABLE "ApiKeyWorkspace" (id text PRIMARY KEY, "apiKeyId" text, "workspaceId" text, permission "ApiKeyPermission");
CREATE TABLE "Survey" (id text PRIMARY KEY, "workspaceId" text);
CREATE TABLE "Dashboard" (id text PRIMARY KEY, "workspaceId" text);
CREATE TABLE "Response" (id text PRIMARY KEY, "surveyId" text);
CREATE TABLE "FeedbackDirectory" (id text PRIMARY KEY, "organizationId" text, "isArchived" boolean NOT NULL);
CREATE TABLE "FeedbackDirectoryWorkspace" ("feedbackDirectoryId" text, "workspaceId" text, PRIMARY KEY ("feedbackDirectoryId","workspaceId"));
INSERT INTO "Organization" VALUES ('org'),('foreign');
INSERT INTO "User" VALUES ('owner',true),('manager',true),('member',true),('billing',true),('outsider',true),('inactive',false),('multi',true);
INSERT INTO "Membership" VALUES ('org','owner','owner'),('org','manager','manager'),('org','member','member'),('org','billing','billing'),('org','inactive','owner'),('org','multi','member'),('foreign','multi','owner');
INSERT INTO "Workspace" VALUES ('read','org','Read'),('write','org','Write'),('manage','org','Manage'),('none','org','None'),('foreign','foreign','Foreign');
INSERT INTO "Team" VALUES ('team','org'),('stronger','org'),('foreign-team','foreign');
INSERT INTO "TeamUser" SELECT 'team',id,'contributor' FROM "User";
INSERT INTO "TeamUser" VALUES ('stronger','member','admin'),('foreign-team','member','admin');
INSERT INTO "WorkspaceTeam" VALUES ('read','team','read'),('write','team','readWrite'),('manage','team','manage'),('read','stronger','manage'),('none','foreign-team','manage');
INSERT INTO "ApiKey" VALUES ('key','org','{"accessControl":{"write":true}}'),('foreign-key','foreign','{}');
INSERT INTO "ApiKeyWorkspace" VALUES ('g1','key','read','read'),('g2','key','write','write'),('g3','key','manage','manage'),('g4','key','foreign','manage');
INSERT INTO "Survey" VALUES ('survey','write');
INSERT INTO "Dashboard" VALUES ('dashboard','read');
INSERT INTO "Response" VALUES ('response','survey');
INSERT INTO "FeedbackDirectory" VALUES ('dataset','org',false),('unassigned','org',false),('archived','org',true);
INSERT INTO "FeedbackDirectoryWorkspace" VALUES ('dataset','read'),('dataset','none'),('dataset','foreign'),('archived','read');
`;

beforeAll(async () => {
  const password = randomBytes(24).toString("hex");
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      name,
      "--publish",
      "127.0.0.1::5432",
      "--env",
      "POSTGRES_USER=bridge",
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--env",
      "POSTGRES_DB=bridge",
      "postgres:17-alpine",
    ],
    { stdio: "ignore" }
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      // Initdb's temporary server accepts Unix-socket connections, then stops. Wait for TCP instead.
      execFileSync("docker", ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "bridge"], {
        stdio: "ignore",
      });
      break;
    } catch {
      if (attempt === 99) throw new Error("Disposable bridge database did not become ready");
      await setTimeout(100);
    }
  }
  const port = execFileSync("docker", ["port", name, "5432/tcp"], { encoding: "utf8" })
    .trim()
    .split(":")
    .at(-1);
  const { adapter } = createPrismaPgAdapter(
    `postgresql://bridge:${password}@127.0.0.1:${port}/bridge?connection_limit=2`
  );
  db.client = new PrismaClient({ adapter });
  for (const statement of fixture
    .split(";")
    .map((sql) => sql.trim())
    .filter(Boolean)) {
    await db.client.$executeRawUnsafe(statement);
  }
});

afterAll(async () => {
  try {
    await db.client?.$disconnect();
  } finally {
    execFileSync("docker", ["rm", "--force", "--volumes", name], { stdio: "ignore" });
  }
});

describe("real PostgreSQL bridge authorization", () => {
  test.each(["owner", "manager"])("%s lists every workspace in its organization", async (id) => {
    await expect(lookupAuthorizedWorkspaceIds(user(id))).resolves.toEqual([
      "manage",
      "none",
      "read",
      "write",
    ]);
  });
  test.each(["billing", "outsider", "inactive", "missing"])("%s never inherits team access", async (id) => {
    await expect(lookupAuthorizedWorkspaceIds(user(id))).resolves.toEqual([]);
    await expect(can(user(id), "workspace.read", { type: "workspace", id: "read" })).resolves.toBe(false);
  });
  test("organization lists retain billing but exclude inactive and missing users", async () => {
    await expect(lookupAuthorizedOrganizationIds(user("billing"))).resolves.toEqual(["org"]);
    await expect(lookupAuthorizedOrganizationIds(user("inactive"))).resolves.toEqual([]);
    await expect(lookupAuthorizedOrganizationIds(user("missing"))).resolves.toEqual([]);
  });
  test("multi-organization lists use the role and team grant in each organization", async () => {
    await expect(lookupAuthorizedOrganizationIds(user("multi"))).resolves.toEqual(["foreign", "org"]);
    await expect(lookupAuthorizedWorkspaceIds(user("multi"))).resolves.toEqual([
      "foreign",
      "manage",
      "read",
      "write",
    ]);
    await expect(lookupAuthorizedWorkspaceIds(user("multi"), "write")).resolves.toEqual([
      "foreign",
      "manage",
      "write",
    ]);
  });
  test("cross-organization team grants never grant the target workspace", async () => {
    await expect(lookupAuthorizedWorkspaceIds(user("member"))).resolves.toEqual(["manage", "read", "write"]);
    await expect(can(user("member"), "workspace.manage", { type: "workspace", id: "none" })).resolves.toBe(
      false
    );
  });
  test("multi-team union grants highest access and revokes immediately after downgrade/removal", async () => {
    try {
      await expect(can(user("member"), "workspace.manage", { type: "workspace", id: "read" })).resolves.toBe(
        true
      );
      await db.client!
        .$executeRaw`UPDATE "WorkspaceTeam" SET permission = 'read' WHERE "teamId" = 'stronger'`;
      await expect(can(user("member"), "workspace.write", { type: "workspace", id: "read" })).resolves.toBe(
        false
      );
      await db.client!
        .$executeRaw`DELETE FROM "TeamUser" WHERE "userId" = 'member' AND "teamId" = 'stronger'`;
      await expect(can(user("member"), "workspace.read", { type: "workspace", id: "read" })).resolves.toBe(
        true
      );
      await db.client!.$executeRaw`DELETE FROM "TeamUser" WHERE "userId" = 'member' AND "teamId" = 'team'`;
      await expect(can(user("member"), "workspace.read", { type: "workspace", id: "read" })).resolves.toBe(
        false
      );
    } finally {
      await db.client!
        .$executeRaw`UPDATE "WorkspaceTeam" SET permission = 'manage' WHERE "teamId" = 'stronger'`;
      await db.client!
        .$executeRaw`INSERT INTO "TeamUser" VALUES ('stronger','member','admin'), ('team','member','contributor') ON CONFLICT DO NOTHING`;
    }
  });
  test("API-key lists and scalar checks reject foreign grants and honor every permission tier", async () => {
    await expect(lookupAuthorizedWorkspaceIds(key("key"))).resolves.toEqual(["manage", "read", "write"]);
    await expect(lookupAuthorizedWorkspaceIds(key("key"), "write")).resolves.toEqual(["manage", "write"]);
    await expect(lookupAuthorizedOrganizationIds(key("key"))).resolves.toEqual(["org"]);
    for (const id of ["read", "write", "manage"]) {
      for (const permission of ["read", "write", "manage"] as const) {
        const rank = { read: 0, write: 1, manage: 2 };
        await expect(can(key("key"), `workspace.${permission}`, { type: "workspace", id })).resolves.toBe(
          rank[id as keyof typeof rank] >= rank[permission]
        );
      }
    }
    await expect(can(key("key"), "workspace.read", { type: "workspace", id: "foreign" })).resolves.toBe(
      false
    );
    await expect(can(key("foreign-key"), "survey.read", { type: "survey", id: "survey" })).resolves.toBe(
      false
    );
    await expect(lookupAuthorizedWorkspaceIds(key("deleted"))).resolves.toEqual([]);
  });
  test("derived resources preserve read/write/manage rules", async () => {
    await expect(can(user("member"), "survey.delete", { type: "survey", id: "survey" })).resolves.toBe(true);
    await expect(can(user("member"), "survey.manage", { type: "survey", id: "survey" })).resolves.toBe(false);
    await expect(can(user("member"), "response.export", { type: "response", id: "response" })).resolves.toBe(
      true
    );
    await expect(can(user("member"), "response.manage", { type: "response", id: "response" })).resolves.toBe(
      false
    );
    await expect(can(user("multi"), "dashboard.write", { type: "dashboard", id: "dashboard" })).resolves.toBe(
      false
    );
  });
  test("dataset union cannot authorize an exact unassigned/foreign/archived pair", async () => {
    await expect(
      can(user("member"), "feedbackDirectory.read", { type: "feedbackDirectory", id: "dataset" })
    ).resolves.toBe(true);
    for (const workspaceId of ["none", "foreign", "write"]) {
      await expect(
        can(user("member"), "feedbackDirectoryAssignment.read", {
          type: "feedbackDirectoryAssignment",
          feedbackDirectoryId: "dataset",
          workspaceId,
        })
      ).resolves.toBe(false);
    }
    await expect(
      can(user("owner"), "feedbackDirectory.read", { type: "feedbackDirectory", id: "archived" })
    ).resolves.toBe(false);
    await expect(
      can(user("owner"), "feedbackDirectory.read", { type: "feedbackDirectory", id: "unassigned" })
    ).resolves.toBe(true);
  });
  test("no decision constructed a client or consulted projection freshness", () => {
    expect(getAuthzedClient).not.toHaveBeenCalled();
    expect(assertAuthzedProjectionFreshness).not.toHaveBeenCalled();
  });
});
