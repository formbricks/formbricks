import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { PrismaClient } from "@formbricks/database/prisma";
import { createPrismaPgAdapter } from "@formbricks/database/prisma-adapter";
import { getDashboard } from "@/modules/ee/analysis/dashboards/lib/dashboards";
import { ZChartCreateInput } from "@/modules/ee/analysis/types/analysis";
import { createChart, deleteChart, duplicateChart, getChart, getCharts, updateChart } from "./charts";

const db = vi.hoisted(() => ({ client: undefined as PrismaClient | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  get prisma() {
    if (!db.client) throw new Error("Disposable chart database not ready");
    return db.client;
  },
}));

const name = `formbricks-bridge-chart-${randomUUID()}`;
const sql = (input: string) =>
  execFileSync("docker", ["exec", "-i", name, "psql", "-U", "bridge", "-v", "ON_ERROR_STOP=1"], {
    input,
    stdio: ["pipe", "ignore", "pipe"],
  });

beforeAll(async () => {
  const password = randomBytes(24).toString("hex");
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      name,
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_USER=bridge",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "postgres:17-alpine",
    ],
    { stdio: "ignore" }
  );
  for (let i = 0; i < 100; i++) {
    try {
      execFileSync("docker", ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "bridge"], {
        stdio: "ignore",
      });
      break;
    } catch {
      if (i === 99) throw new Error("Disposable chart database unavailable");
      await setTimeout(100);
    }
  }
  const port = execFileSync("docker", ["port", name, "5432/tcp"], { encoding: "utf8" })
    .trim()
    .split(":")
    .at(-1);
  db.client = new PrismaClient({
    adapter: createPrismaPgAdapter(`postgresql://bridge:${password}@127.0.0.1:${port}/bridge`).adapter,
  });
  sql(`
    CREATE TYPE "ChartType" AS ENUM ('line','area','bar','pie','big_number');
    CREATE TABLE "User" (id text PRIMARY KEY, name text);
    CREATE TABLE "Chart" (
      id text PRIMARY KEY, name text, type "ChartType", "workspaceId" text,
      query jsonb DEFAULT '{}', config jsonb DEFAULT '{}', "createdBy" text,
      "feedbackDirectoryId" text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
    );
    CREATE TABLE "Dashboard" (id text PRIMARY KEY, name text, "workspaceId" text, "createdBy" text,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE "DashboardWidget" (id text PRIMARY KEY, "dashboardId" text, "chartId" text, layout jsonb,
      "order" integer, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    INSERT INTO "User" VALUES ('creator','Fixture');
    INSERT INTO "Chart" (id,name,type,"workspaceId",query,config,"createdBy","feedbackDirectoryId")
      VALUES ('legacychart','Legacy','line','workspace','{"measures":["FeedbackRecords.count"]}',
        '{"showLegend":true}','creator','directory'),
        ('migrationchart','Migration','line','workspace','{}','{}','creator','directory');
    INSERT INTO "Dashboard" (id,name,"workspaceId") VALUES ('dashboard','Dashboard','workspace');
    INSERT INTO "DashboardWidget" (id,"dashboardId","chartId",layout,"order")
      VALUES ('widget','dashboard','legacychart','{}',0);
  `);
});

afterAll(async () => {
  try {
    await db.client?.$disconnect();
  } finally {
    execFileSync("docker", ["rm", "-f", "-v", name], { stdio: "ignore" });
  }
});

test("bridge reads v5 line rows through chart and nested dashboard services without writing them", async () => {
  expect(await getChart("legacychart", "workspace")).toMatchObject({
    type: "area",
    config: { areaDisplay: "line", showLegend: true },
  });
  expect((await getCharts("workspace")).every((chart) => chart.type === "area")).toBe(true);
  expect((await getDashboard("dashboard", "workspace")).widgets[0].chart).toMatchObject({
    type: "area",
    config: { areaDisplay: "line" },
  });
  expect(await db.client!.chart.findUnique({ where: { id: "legacychart" }, select: { type: true } })).toEqual(
    { type: "line" }
  );
  await expect(getChart("legacychart", "foreign")).rejects.toThrow();
});

test("duplicates and edits never write the old enum and preserve line styling", async () => {
  const duplicate = await duplicateChart("legacychart", "workspace", "creator");
  expect(duplicate).toMatchObject({ type: "area", config: { areaDisplay: "line", showLegend: true } });
  const updated = await updateChart("legacychart", "workspace", { name: "Renamed" });
  expect(updated.updatedChart).toMatchObject({
    type: "area",
    config: { areaDisplay: "line", showLegend: true },
  });
  expect(await db.client!.chart.findUnique({ where: { id: "legacychart" }, select: { type: true } })).toEqual(
    { type: "area" }
  );
  expect(
    ZChartCreateInput.safeParse({
      ...duplicate,
      workspaceId: "workspace",
      createdBy: "creator",
      type: "line",
    }).success
  ).toBe(false);
});

test("the unchanged canonical migration preserves reads and bridge writes after enum contraction", async () => {
  const migration = readFileSync(
    new URL(
      "../../../../../../../packages/database/migration/20260826120000_eng_2612_merge_line_chart_type_into_area/migration.sql",
      import.meta.url
    ),
    "utf8"
  );
  sql(migration);
  sql(migration); // Canonical idempotency, not an alternate migration.
  expect(await getChart("migrationchart", "workspace")).toMatchObject({
    type: "area",
    config: { areaDisplay: "line" },
  });
  const created = await createChart({
    name: "After contraction",
    type: "area",
    workspaceId: "workspace",
    createdBy: "creator",
    feedbackDirectoryId: "directory",
    query: {},
    config: { areaDisplay: "line" },
  });
  expect(await deleteChart(created.id, "workspace")).toMatchObject({
    type: "area",
    config: { areaDisplay: "line" },
  });
  expect((await getDashboard("dashboard", "workspace")).widgets[0].chart.config).toMatchObject({
    areaDisplay: "line",
  });
});
