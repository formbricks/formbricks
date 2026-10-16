import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { DEFAULT_CREATIVE_DISTRIBUTION, DEFAULT_CREATIVE_STYLING, type TCreativeState } from "./creative";
import { type TCreativeRecord, findCreativeRecordsPage } from "./repository";
import { CreativeReferenceError, createCreative } from "./service";

/**
 * The creatives storage against a real PostgreSQL: the list query (the derived-status filter, the
 * keyset walk) and the Destination foreign key (ADR 0010), which a mocked repository can't show.
 */

vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const NOW = new Date("2026-10-15T12:00:00.000Z");
const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

const seedWorkspace = async (label: string) => {
  const organization = await prisma.organization.create({ data: { name: `${label} Org` } });
  const workspace = await prisma.workspace.create({
    data: { name: `${label} Workspace`, organizationId: organization.id },
  });
  const survey = (name: string, status: "inProgress" | "paused") =>
    prisma.survey.create({ data: { name, status, type: "app", workspaceId: workspace.id } });
  const [activeSurvey, pausedSurvey] = await Promise.all([
    survey("Active", "inProgress"),
    survey("Paused", "paused"),
  ]);
  return { organizationId: organization.id, workspaceId: workspace.id, activeSurvey, pausedSurvey };
};

const feedbackButtonState = (overrides: Partial<TCreativeState> = {}): TCreativeState =>
  ({
    type: "feedbackButton",
    content: { label: { "en-US": "Feedback" }, icon: null },
    styling: DEFAULT_CREATIVE_STYLING.feedbackButton,
    name: "Creative",
    status: "inProgress",
    publishedAt: NOW,
    archivedAt: null,
    defaultLanguage: "en-US",
    languages: [],
    destination: null,
    distribution: DEFAULT_CREATIVE_DISTRIBUTION,
    schedule: { startAt: null, endAt: null },
    ...overrides,
  }) as TCreativeState;

const create = (workspaceId: string, overrides: Partial<TCreativeState> = {}): Promise<TCreativeRecord> =>
  createCreative({ workspaceId, createdBy: null, state: feedbackButtonState(overrides) });

const page = (workspaceId: string, query: Partial<Parameters<typeof findCreativeRecordsPage>[0]> = {}) =>
  findCreativeRecordsPage({ workspaceId, sortBy: "name", after: null, take: 50, now: NOW, ...query });

const names = (records: TCreativeRecord[]) => records.map(({ name }) => name);

beforeEach(async () => {
  await resetDb();
});

describe("findCreativeRecordsPage", () => {
  test("filters on the derived display status, and leaves archived creatives out by default", async () => {
    const { workspaceId, activeSurvey, pausedSurvey } = await seedWorkspace("Filter");
    await create(workspaceId, { name: "active", destination: { type: "survey", surveyId: activeSurvey.id } });
    await create(workspaceId, {
      name: "paused with its survey",
      destination: { type: "survey", surveyId: pausedSurvey.id },
    });
    await create(workspaceId, { name: "paused by its author", status: "paused" });
    await create(workspaceId, { name: "scheduled", schedule: { startAt: hoursFromNow(2), endAt: null } });
    await create(workspaceId, { name: "ended", schedule: { startAt: null, endAt: hoursFromNow(-2) } });
    await create(workspaceId, { name: "draft", status: "draft", publishedAt: null });
    await create(workspaceId, { name: "archived", archivedAt: hoursFromNow(-1) });

    expect(names(await page(workspaceId, { displayStatuses: ["paused"] }))).toEqual([
      "paused by its author",
      "paused with its survey",
    ]);
    expect(names(await page(workspaceId, { displayStatuses: ["closed", "scheduled"] }))).toEqual([
      "ended",
      "scheduled",
    ]);
    expect(names(await page(workspaceId, { displayStatuses: ["archived"] }))).toEqual(["archived"]);
    expect(names(await page(workspaceId))).not.toContain("archived");
    expect(names(await page(workspaceId))).toHaveLength(6);
  });

  test("scopes to the workspace and narrows by name, type and survey", async () => {
    const { workspaceId, activeSurvey } = await seedWorkspace("Narrow");
    const other = await seedWorkspace("Other");
    await create(workspaceId, {
      name: "100% feedback",
      destination: { type: "survey", surveyId: activeSurvey.id },
    });
    await create(workspaceId, { name: "100 feedback" });
    await create(other.workspaceId, { name: "100% feedback elsewhere" });

    // `%` is a literal, not a wildcard.
    expect(names(await page(workspaceId, { name: "100%" }))).toEqual(["100% feedback"]);
    expect(names(await page(workspaceId, { surveyId: activeSurvey.id }))).toEqual(["100% feedback"]);
    expect(names(await page(workspaceId, { types: ["banner"] }))).toEqual([]);
  });

  test.each(["name", "updatedAt", "createdAt"] as const)(
    "walks every row exactly once, in order, sorted by %s",
    async (sortBy) => {
      const { workspaceId } = await seedWorkspace(`Walk ${sortBy}`);
      // Duplicate names and shared timestamps put page boundaries inside tie groups.
      for (const name of ["b", "a", "c", "a", "b", "a", "c"]) {
        await create(workspaceId, { name });
      }
      await prisma.creative.updateMany({ where: { workspaceId }, data: { updatedAt: NOW, createdAt: NOW } });

      const seen: TCreativeRecord[] = [];
      let after: { value: string; id: string } | null = null;
      for (let guard = 0; guard < 10; guard++) {
        const rows = await page(workspaceId, { sortBy, after, take: 3 });
        const pageRows = rows.slice(0, 2);
        seen.push(...pageRows);
        const last = pageRows.at(-1);
        if (rows.length <= 2 || !last) break;
        after = { value: sortBy === "name" ? last.name : last[sortBy].toISOString(), id: last.id };
      }

      expect(new Set(seen.map(({ id }) => id)).size).toBe(7);
      expect(seen).toHaveLength(7);
      if (sortBy === "name") expect(names(seen)).toEqual(["a", "a", "a", "b", "b", "c", "c"]);
    }
  );
});

describe("the Destination foreign key", () => {
  test("a creative can only open a survey of its own workspace", async () => {
    const { workspaceId } = await seedWorkspace("Mine");
    const other = await seedWorkspace("Theirs");

    await expect(
      create(workspaceId, { destination: { type: "survey", surveyId: other.activeSurvey.id } })
    ).rejects.toBeInstanceOf(CreativeReferenceError);
    await expect(
      prisma.creative.create({
        data: {
          name: "Raw",
          type: "feedbackButton",
          workspaceId,
          surveyId: other.activeSurvey.id,
          content: {},
          styling: {},
        },
      })
    ).rejects.toThrow();
  });

  test("blocks deleting a linked survey, but not deleting the workspace that holds both", async () => {
    const { organizationId, workspaceId, activeSurvey } = await seedWorkspace("Cascade");
    await create(workspaceId, { destination: { type: "survey", surveyId: activeSurvey.id } });

    await expect(prisma.survey.delete({ where: { id: activeSurvey.id } })).rejects.toThrow();

    await prisma.workspace.delete({ where: { id: workspaceId } });
    expect(await prisma.creative.count({ where: { workspaceId } })).toBe(0);
    await prisma.organization.delete({ where: { id: organizationId } });
  });
});
