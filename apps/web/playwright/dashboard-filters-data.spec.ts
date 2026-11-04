import { createId } from "@paralleldrive/cuid2";
import { type Browser, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { createUsersFixture, login } from "./fixtures/users";
import { test } from "./lib/fixtures";
import {
  type DashboardSetup,
  type SeedDashboardFilter,
  addDashboardViewer,
  dashboardUrl,
} from "./utils/dashboards";
import { type HubRecord, createHubRecords, deleteHubTenant, isHubAndCubeReachable } from "./utils/hub";

// ENG-6896 dashboard filters against real chart data: feedback records in Formbricks Hub, queried through
// Cube with this branch's model. CI starts neither service, so the whole file skips without them (the
// `@hub-cube` tag names the dependency); run it locally with Hub and Cube up.
//
// One organization is seeded once for the file — thousands of records are too slow to write per test — and
// the tests only read it: picks are each person's own (URL and cookie), never written to the dashboard.

const AREA_MANAGERS = ["Rossi", "Bianchi", "Conti", "Greco"] as const;
const PRODUCTS = ["Alpha", "Beta", "Gamma"] as const;
const ZONES = ["Nord", "Sud"] as const;
const VISITS = 3000; // one rep per visit: a categorical field with thousands of values
const REVIEWS = 40;

const repOf = (visit: number) => `Rep ${String(visit).padStart(4, "0")}`;
const isLate = (visit: number) => visit % 5 === 0;

const SURVEY_BLOCKS = [
  {
    id: createId(),
    name: "Visit",
    elements: [
      {
        id: "delivery",
        type: "multipleChoiceSingle",
        headline: { default: "How was delivery?" },
        required: false,
        shuffleOption: "none",
        choices: [
          { id: "late", label: { default: "Late" } },
          { id: "on_time", label: { default: "On time" } },
        ],
      },
      {
        id: "nps",
        type: "nps",
        headline: { default: "How likely are you to recommend us?" },
        required: false,
      },
    ],
  },
];

interface Seeded extends DashboardSetup {
  datasets: { visits: string; reviews: string; empty: string };
  charts: { visits: string; reviews: string; byProduct: string; late: string; empty: string };
  filters: { areaManager: SeedDashboardFilter; rep: SeedDashboardFilter };
  embeddedMembers: Record<string, string>;
}

let seeded: Seeded | undefined;
let reachable = false;

/** The visits dataset: every embedded key on every record, a few with awkward names. */
const visitRecords = (tenantId: string, surveyId: string): HubRecord[] =>
  Array.from({ length: VISITS }, (_, visit) => {
    const embedded_data = {
      "Area Manager": AREA_MANAGERS[visit % AREA_MANAGERS.length],
      Rep: repOf(visit),
      Product: PRODUCTS[visit % PRODUCTS.length],
      "région/zone": ZONES[visit % ZONES.length],
      "key.with.dots": "dotted",
    };
    const base = {
      tenant_id: tenantId,
      submission_id: `visit-${visit}`,
      source_type: "formbricks",
      source_id: surveyId,
      source_name: "Visit survey",
      collected_at: new Date(Date.UTC(2026, 9, 1 + (visit % 28))).toISOString(),
      metadata: { embedded_data },
    };
    return [
      { ...base, field_id: "nps", field_type: "nps" as const, value_number: visit % 11 },
      {
        ...base,
        field_id: "delivery",
        field_type: "categorical" as const,
        value_id: isLate(visit) ? "late" : "on_time",
        value_text: isLate(visit) ? "Late" : "On time",
      },
    ];
  }).flat();

/** The reviews dataset: Area Manager and Product only — no Rep, no zone. */
const reviewRecords = (tenantId: string): HubRecord[] =>
  Array.from({ length: REVIEWS }, (_, review) => ({
    tenant_id: tenantId,
    submission_id: `review-${review}`,
    source_type: "review",
    field_id: "rating",
    field_type: "rating" as const,
    value_number: (review % 5) + 1,
    collected_at: new Date(Date.UTC(2026, 9, 1 + (review % 28))).toISOString(),
    metadata: {
      embedded_data: { "Area Manager": AREA_MANAGERS[review % AREA_MANAGERS.length], Product: "Alpha" },
    },
  }));

const seed = async (browser: Browser): Promise<Seeded> => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const users = createUsersFixture(page, test.info());
  const owner = await users.create();
  if (!owner.organizationId || !owner.workspaceId) throw new Error("Owner org/workspace not seeded");
  const { organizationId, workspaceId } = owner;
  const suffix = createId().slice(0, 8);

  const newDataset = async (name: string) =>
    (
      await prisma.feedbackDirectory.create({
        data: { name: `${name} ${suffix}`, organizationId, workspaces: { create: { workspaceId } } },
      })
    ).id;
  const datasets = {
    visits: await newDataset("Field visits"),
    reviews: await newDataset("Store reviews"),
    empty: await newDataset("Not yet imported"),
  };

  // The survey behind the visits, mapped into its dataset, is what offers "Delivery" to an answer rule.
  const survey = await prisma.survey.create({
    data: {
      name: `Visit survey ${suffix}`,
      workspaceId,
      blocks: SURVEY_BLOCKS as never,
      status: "inProgress",
    },
  });
  const source = await prisma.feedbackSource.create({
    data: {
      name: `Visits ${suffix}`,
      type: "formbricks_survey",
      workspaceId,
      feedbackDirectoryId: datasets.visits,
    },
  });
  for (const [elementId, hubFieldType] of [
    ["delivery", "categorical"],
    ["nps", "nps"],
  ] as const) {
    await prisma.feedbackSourceFormbricksMapping.create({
      data: { feedbackSourceId: source.id, workspaceId, surveyId: survey.id, elementId, hubFieldType },
    });
  }

  await createHubRecords([...visitRecords(datasets.visits, survey.id), ...reviewRecords(datasets.reviews)]);

  // Embedded keys get their member names from the dataset's catalog, as the chart builder reads them.
  await owner.login();
  const embeddedMembers: Record<string, string> = {};
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/v3/charts/fields", {
          params: { workspaceId, datasetId: datasets.visits },
        });
        if (!response.ok()) return 0;
        const { data } = (await response.json()) as { data: { fields: { name: string; key?: string }[] } };
        for (const field of data.fields) if (field.key) embeddedMembers[field.key] = field.name;
        return Object.keys(embeddedMembers).length;
      },
      { timeout: 60_000, message: "the visits dataset's embedded keys reach its field catalog" }
    )
    .toBeGreaterThanOrEqual(5);

  const nps = { member: "FeedbackRecords.fieldId", operator: "equals", values: ["nps"] };
  const newChart = async (name: string, feedbackDirectoryId: string, query: object) =>
    (
      await prisma.chart.create({
        data: {
          name: `${name}`,
          type: "bar",
          workspaceId,
          feedbackDirectoryId,
          createdBy: owner.id,
          query,
          config: {},
        },
      })
    ).id;
  const charts = {
    visits: await newChart("Visits", datasets.visits, {
      measures: ["FeedbackRecords.count"],
      filters: [nps],
    }),
    reviews: await newChart("Store reviews", datasets.reviews, {
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["rating"] }],
    }),
    byProduct: await newChart("Visits in Nord by product", datasets.visits, {
      measures: ["FeedbackRecords.count"],
      dimensions: [embeddedMembers.Product],
      filters: [nps, { member: embeddedMembers["région/zone"], operator: "equals", values: ["Nord"] }],
    }),
    late: await newChart("Visits where delivery was late", datasets.visits, {
      measures: ["FeedbackRecords.count"],
      filters: [nps, { member: "FeedbackRecords.answer", operator: "equals", values: ["delivery:late"] }],
    }),
    empty: await newChart("Not yet imported", datasets.empty, { measures: ["FeedbackRecords.count"] }),
  };

  const filters = {
    areaManager: {
      id: createId(),
      field: embeddedMembers["Area Manager"],
      operator: "equals" as const,
      label: "Area Manager",
    },
    rep: { id: createId(), field: embeddedMembers.Rep, operator: "equals" as const, label: "Rep" },
  };
  const dashboardName = `Field force ${suffix}`;
  const order = [charts.visits, charts.reviews, charts.byProduct, charts.late, charts.empty];
  const dashboard = await prisma.dashboard.create({
    data: {
      name: dashboardName,
      workspaceId,
      createdBy: owner.id,
      filters: [filters.areaManager, filters.rep] as unknown as object[],
      widgets: {
        create: order.map((chartId, index) => ({
          chartId,
          order: index,
          layout: { x: (index % 2) * 6, y: Math.floor(index / 2) * 4, w: 6, h: 4 },
        })),
      },
    },
  });
  const team = await prisma.team.create({
    data: {
      name: `Dashboards ${suffix}`,
      organizationId,
      workspaceTeams: { create: { workspaceId, permission: "read" } },
    },
  });

  await context.close();
  return {
    owner,
    organizationId,
    workspaceId,
    feedbackDirectoryId: datasets.visits,
    dashboardId: dashboard.id,
    dashboardName,
    chartId: charts.visits,
    chartName: "Visits",
    teamId: team.id,
    datasets,
    charts,
    filters,
    embeddedMembers,
  };
};

const widget = (page: Page, chartName: string) =>
  page.locator(".react-grid-item").filter({ has: page.getByText(chartName, { exact: true }) });

/** A widget's numbers in its Data view, which reads them as a table rather than as bars. */
const showData = async (page: Page, chartName: string) => {
  await widget(page, chartName).getByRole("button", { name: "Data" }).click();
};

/** Sign the file's seeded owner in on this test's page (the fixture's own page closed with the seed). */
const loginAsOwner = async (page: Page) =>
  login(
    await prisma.user.findUniqueOrThrow({ where: { id: seeded!.owner.id }, include: { memberships: true } }),
    page
  );

/** A single-number widget's Data view ends with its count, as the app formats it ("3,000"). */
const expectCount = async (page: Page, chartName: string, count: number) =>
  expect(widget(page, chartName)).toContainText(
    new RegExp(`Feedback Records${count.toLocaleString("en-US")}$`)
  );

/** Pick one value in an open list; the pick is applied through the URL, so wait for it to read as picked. */
const pick = async (list: ReturnType<Page["getByRole"]>, value: string) => {
  const box = list.getByRole("checkbox", { name: value });
  await box.click();
  await expect(box).toBeChecked();
};

const openFilter = async (page: Page, label: string) => {
  await page
    .getByTestId("dashboard-filter-bar")
    .getByRole("button", { name: `Edit ${label}` })
    .click();
  return page.getByRole("list", { name: label });
};

test.describe("Dashboard filters on chart data @hub-cube", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    reachable = await isHubAndCubeReachable();
    if (!reachable) return;
    test.setTimeout(10 * 60 * 1000);
    seeded = await seed(browser);
  });

  test.afterAll(async () => {
    if (!seeded) return;
    await Promise.all(Object.values(seeded.datasets).map(deleteHubTenant));
  });

  test.beforeEach(() => {
    test.skip(!reachable, "Needs Formbricks Hub and Cube (HUB_API_URL, CUBEJS_API_URL); CI starts neither.");
  });

  test("a pick narrows every chart, and a chart whose dataset lacks the field says so", async ({
    page,
    users,
  }) => {
    const s = seeded!;
    const viewer = await addDashboardViewer(users, s);
    await viewer.login();
    await page.goto(dashboardUrl(s.workspaceId, s.dashboardId));

    for (const name of ["Visits", "Store reviews", "Visits where delivery was late"])
      await showData(page, name);
    await expectCount(page, "Visits", 3000);
    await expectCount(page, "Store reviews", REVIEWS);
    await expectCount(page, "Visits where delivery was late", 600);
    await expect(widget(page, "Not yet imported")).toBeVisible();

    const list = await openFilter(page, "Area Manager");
    await pick(list, "Bianchi");
    await page.keyboard.press("Escape");

    // Visits with s % 4 == 1; reviews likewise; late visits are s % 20 == 5.
    await expectCount(page, "Visits", 750);
    await expectCount(page, "Store reviews", REVIEWS / 4);
    await expectCount(page, "Visits where delivery was late", 150);

    const reps = await openFilter(page, "Rep");
    await pick(reps, repOf(1));
    await page.keyboard.press("Escape");
    await expectCount(page, "Visits", 1);
    await expect(widget(page, "Store reviews")).toContainText("This chart can't be filtered by Rep");
  });

  test("value lists load when opened, narrow each other, and ask to refine a long list", async ({
    page,
    users,
  }) => {
    const s = seeded!;
    const viewer = await addDashboardViewer(users, s);
    await viewer.login();

    const valueRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/v3\/dashboards\/[^/]+\/filters\/[^/]+\/values/.test(request.url()))
        valueRequests.push(request.url());
    });
    await page.goto(dashboardUrl(s.workspaceId, s.dashboardId));
    await expect(widget(page, "Visits")).toBeVisible();
    expect(valueRequests, "no value list loads before a filter is opened").toEqual([]);

    // Thousands of reps: the first page, and a hint to search for the rest.
    let reps = await openFilter(page, "Rep");
    await expect(reps.getByText(/Showing the first \d+ values\. Search to find more\./)).toBeVisible();
    expect(valueRequests).toHaveLength(1);
    await page.getByRole("textbox", { name: "Search Rep values" }).fill(repOf(2999));
    await expect(reps.getByRole("checkbox", { name: repOf(2999) })).toBeVisible();
    await expect(reps.getByText(/Search to find more/)).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Picking an Area Manager leaves only that manager's reps.
    const managers = await openFilter(page, "Area Manager");
    await expect(managers.getByRole("checkbox")).toHaveCount(AREA_MANAGERS.length);
    await pick(managers, "Conti");
    await page.keyboard.press("Escape");

    reps = await openFilter(page, "Rep");
    await expect(reps.getByRole("checkbox").first()).toBeVisible();
    for (const name of await reps
      .getByRole("checkbox")
      .evaluateAll((boxes) => boxes.map((box) => box.closest("label")?.textContent?.trim() ?? ""))) {
      expect(Number(name.replace("Rep ", "")) % AREA_MANAGERS.length, `${name} belongs to Conti`).toBe(2);
    }
    await page.getByRole("textbox", { name: "Search Rep values" }).fill(repOf(1));
    await expect(reps.getByText("No results")).toBeVisible();
  });

  test("a chart grouped by one embedded field and filtered by another, with an awkward key name", async ({
    page,
  }) => {
    const s = seeded!;
    await loginAsOwner(page);
    await page.goto(dashboardUrl(s.workspaceId, s.dashboardId));
    await showData(page, "Visits in Nord by product");
    const table = widget(page, "Visits in Nord by product");
    // Even visits (Nord) split evenly over three products.
    for (const product of PRODUCTS) {
      await expect(table.getByRole("row").filter({ hasText: product })).toHaveText(`${product}500`);
    }
    // The column is headed by the key itself, never its member name.
    await expect(table).toContainText("Product");
    await expect(table).not.toContainText("ed_");
  });

  test("an owner adds a filter on an embedded key with an awkward name, and picking it narrows the charts", async ({
    page,
  }) => {
    const s = seeded!;
    await loginAsOwner(page);
    await page.goto(dashboardUrl(s.workspaceId, s.dashboardId));
    await showData(page, "Visits");
    await expectCount(page, "Visits", 3000);

    await page.locator("body").press("e");
    await page.getByTestId("dashboard-filter-bar").getByRole("button", { name: "Add filter" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Field" }).click();
    await page.getByPlaceholder("Search").last().fill("région");
    await page.getByRole("option", { name: "région/zone", exact: true }).click();
    await expect(dialog.getByLabel("Label")).toHaveValue("région/zone");
    await dialog.getByRole("button", { name: "Save" }).click();
    await page.getByRole("toolbar", { name: "Action buttons" }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Dashboard saved successfully")).toBeVisible();

    const zones = await openFilter(page, "région/zone");
    await expect(zones.getByRole("checkbox")).toHaveCount(ZONES.length);
    await pick(zones, "Sud");
    await page.keyboard.press("Escape");
    await expectCount(page, "Visits", 1500);
    // The reviews dataset has no zone at all.
    await showData(page, "Store reviews");
    await expect(widget(page, "Store reviews")).toContainText("This chart can't be filtered by région/zone");

    // Leave the shared dashboard as the other tests expect it.
    const stored = await prisma.dashboard.findUniqueOrThrow({ where: { id: s.dashboardId } });
    await prisma.dashboard.update({
      where: { id: s.dashboardId },
      data: {
        filters: (stored.filters as SeedDashboardFilter[]).filter((f) => f.label !== "région/zone") as never,
      },
    });
  });
});
