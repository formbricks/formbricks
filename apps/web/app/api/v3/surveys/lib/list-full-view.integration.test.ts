import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { getV3Survey, listV3Surveys } from "./operations";

/**
 * ENG-6861: `GET /api/v3/surveys?view=full` against a real PostgreSQL.
 *
 * The unit suite mocks the page and the batch read, so it cannot show that the documents the batch
 * query returns are the ones `GET /surveys/{id}` returns, that the cursor walks the whole workspace in
 * `view=full` exactly as in the summary view, or that the batch read stays inside the workspace.
 */

const ids = { apiKey: "", organization: "", workspace: "", otherWorkspace: "" };
const surveyIds: string[] = [];
let legacySurveyId = "";

const instance = "/api/v3/surveys";
const apiKeyAuthentication = () =>
  ({
    apiKeyId: ids.apiKey,
    organizationAccess: { accessControl: { read: false, write: false } },
    organizationId: ids.organization,
    type: "apiKey",
    workspacePermissions: [{ permission: "read", workspaceId: ids.workspace }],
  }) as never;

const blocks = (label: string) => [
  {
    id: `block_${label}`,
    name: `Block ${label}`,
    elements: [
      { id: `q_${label}`, type: "openText", headline: { default: `Question ${label}` }, required: true },
    ],
  },
];

type TListBody = {
  data: Array<Record<string, unknown> & { id: string }>;
  meta: { nextCursor: string | null; unsupportedSurveyIds?: string[] };
};

const listPage = async (query: Record<string, string>): Promise<TListBody> => {
  const response = await listV3Surveys({
    authentication: apiKeyAuthentication(),
    instance,
    requestId: "req",
    searchParams: new URLSearchParams({ workspaceId: ids.workspace, sortBy: "createdAt", ...query }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as TListBody;
};

/** Every page of the collection, following `meta.nextCursor` until it is null. */
const listAll = async (query: Record<string, string>) => {
  const pages: TListBody[] = [];
  let cursor: string | null = null;
  do {
    const page = await listPage({ ...query, includeTotalCount: "false", ...(cursor ? { cursor } : {}) });
    pages.push(page);
    cursor = page.meta.nextCursor;
  } while (cursor);
  return pages;
};

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Full View Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Full View", organizationId: organization.id },
  });
  const otherWorkspace = await prisma.workspace.create({
    data: { name: "Other", organizationId: organization.id },
  });
  ids.organization = organization.id;
  ids.workspace = workspace.id;
  ids.otherWorkspace = otherWorkspace.id;

  const apiKey = await prisma.apiKey.create({
    data: { hashedKey: "full-view-hash", label: "key", organizationId: organization.id },
  });
  await prisma.apiKeyWorkspace.create({
    data: { apiKeyId: apiKey.id, permission: "read", workspaceId: workspace.id },
  });
  ids.apiKey = apiKey.id;

  for (let i = 0; i < 5; i++) {
    const survey = await prisma.survey.create({
      data: {
        name: `Survey ${i}`,
        type: i === 4 ? "app" : "link",
        status: i % 2 === 0 ? "inProgress" : "paused",
        workspaceId: workspace.id,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
        blocks: blocks(String(i)),
        customCss:
          i === 0
            ? {
                light: { source: ".x { color: red; }", compiled: ".x{color:red}" },
                dark: null,
                processorVersion: 1,
              }
            : undefined,
      },
      select: { id: true },
    });
    surveyIds.push(survey.id);
  }

  const legacy = await prisma.survey.create({
    data: {
      name: "Legacy",
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 10)),
      questions: [{ id: "legacy_q", type: "openText", headline: { default: "Old" }, required: true }],
    },
    select: { id: true },
  });
  legacySurveyId = legacy.id;

  await prisma.survey.create({
    data: { name: "Elsewhere", type: "link", status: "inProgress", workspaceId: otherWorkspace.id },
  });

  // Workspace access is decided by the authorization graph, so the fixture has to be projected into it.
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

describe("GET /api/v3/surveys?view=full against a real database", () => {
  test("pages through the same surveys, in the same order, as the summary view", async () => {
    const summary = (await listAll({ limit: "2" })).flatMap((page) => page.data.map(({ id }) => id));
    const fullPages = await listAll({ view: "full", limit: "2" });
    const full = fullPages.flatMap((page) => page.data.map(({ id }) => id));

    expect(summary).toHaveLength(6);
    expect(full).toEqual(summary.filter((id) => id !== legacySurveyId));
    expect(new Set(full)).toEqual(new Set(surveyIds));
    expect(fullPages.flatMap((page) => page.meta.unsupportedSurveyIds)).toEqual([legacySurveyId]);
  });

  test("each item is the summary item plus the document GET /surveys/{id} returns", async () => {
    const [summaryPage, fullPage] = await Promise.all([
      listPage({ limit: "50" }),
      listPage({ view: "full", limit: "50" }),
    ]);
    const summaryById = new Map(summaryPage.data.map((item) => [item.id, item]));

    expect(fullPage.data).toHaveLength(surveyIds.length);
    for (const item of fullPage.data) {
      const detail = await getV3Survey({
        surveyId: item.id,
        authentication: apiKeyAuthentication(),
        requestId: "req",
        instance,
      });
      expect(detail.status).toBe(200);
      const { data: document } = (await detail.json()) as { data: Record<string, unknown> };

      expect(item).toEqual({ ...summaryById.get(item.id), ...document });
    }

    const withCss = fullPage.data.find(({ id }) => id === surveyIds[0]);
    expect(withCss?.customCss).toEqual({ light: ".x { color: red; }", dark: null });
  });

  test("every filter and sort order selects the same surveys, in the same order, in both views", async () => {
    const filters: Record<string, string>[] = [
      {},
      { "filter[status][in]": "paused" },
      { "filter[name][contains]": "survey 1" },
      { "filter[type][in]": "app" },
    ];
    for (const sortBy of ["createdAt", "updatedAt", "name", "relevance"]) {
      for (const filter of filters) {
        const query = { ...filter, sortBy, limit: "2" };
        const summary = (await listAll(query)).flatMap((page) => page.data.map(({ id }) => id));
        const full = (await listAll({ ...query, view: "full" })).flatMap((page) =>
          page.data.map(({ id }) => id)
        );

        expect(full, JSON.stringify(query)).toEqual(summary.filter((id) => id !== legacySurveyId));
      }
    }
  });

  test("an app survey carries the detail endpoint's distribution and targeting", async () => {
    const page = await listPage({ view: "full", "filter[type][in]": "app" });

    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toHaveProperty("distribution");
    expect(page.data[0]).toHaveProperty("targeting");
  });

  test("refuses a workspace the caller cannot read, whatever the view", async () => {
    const response = await listV3Surveys({
      authentication: apiKeyAuthentication(),
      instance,
      requestId: "req",
      searchParams: new URLSearchParams({ workspaceId: ids.otherWorkspace, view: "full" }),
    });

    expect(response.status).toBe(403);
  });
});
