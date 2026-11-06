import { createId } from "@paralleldrive/cuid2";
import { type Browser, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { createUsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";
import {
  type DashboardSetup,
  SENTIMENT_FIELD,
  type SeedLockedFilter,
  addDashboardViewer,
  addFilterRule,
  dashboardUrl,
  filterChips,
  loginOn,
  setupDashboard,
} from "./utils/dashboards";
import { type HubRecord, createHubRecords, deleteHubTenant, isHubAndCubeReachable } from "./utils/hub";

// ENG-6896 user stories, "Dashboard filters": anyone who can open a dashboard filters it for themselves in
// the table toolbar (Filter → Advanced filter, chips); those filters live in the page URL and a cookie, never
// on the dashboard. An Owner or Manager can lock the filters they set for everyone: they are saved on the
// dashboard with their values, the server applies them to every chart read, and a Dashboard viewer sees them
// as locked chips it cannot remove.

// A locked chip says so in screen-reader text: "<filter>, locked".
const lockedChip = (page: Page, name: RegExp) => filterChips(page).getByText(name);

/** The filters a page URL pins, as `<operator>:<field>` → picked values. */
const urlFilters = (page: Page) => {
  const params = new URL(page.url()).searchParams;
  return { rule: params.get("filter[f1]"), picks: params.getAll("picks[f1]") };
};

test.describe("Dashboard filters", () => {
  test("an editor filters through Advanced filter, and the URL and the next visit carry it @smoke", async ({
    page,
    users,
  }) => {
    const setup = await setupDashboard(users);
    await setup.owner.login();
    const url = dashboardUrl(setup.workspaceId, setup.dashboardId);
    await page.goto(url);
    await expect(page.getByText(setup.chartName)).toBeVisible();

    await addFilterRule(page, { field: "Sentiment", operator: "is", value: "Positive" });

    await expect(filterChips(page)).toContainText("Sentiment is");
    await expect(filterChips(page)).toContainText("Positive");
    await expect
      .poll(() => urlFilters(page))
      .toEqual({ rule: `equals:${SENTIMENT_FIELD}`, picks: ["positive"] });

    // A visit without the filters in the URL restores them from this person's dashboard cookie.
    await page.goto("about:blank");
    await page.goto(url);
    await expect(filterChips(page)).toContainText("Positive");

    // Clearing them is remembered too.
    await filterChips(page).getByRole("button", { name: "Clear all" }).click();
    await expect(filterChips(page)).toHaveCount(0);
    await page.goto("about:blank");
    await page.goto(url);
    await expect(page.getByText(setup.chartName)).toBeVisible();
    await expect(filterChips(page)).toHaveCount(0);

    // A person's own filters are their view: nothing was written to the dashboard.
    const stored = await prisma.dashboard.findUniqueOrThrow({ where: { id: setup.dashboardId } });
    expect(stored.filters).toEqual([]);
  });

  test("an editor locks a filter for everyone; a viewer sees it locked and cannot remove it @smoke", async ({
    page,
    users,
    browser,
  }) => {
    const setup = await setupDashboard(users);
    const viewer = await addDashboardViewer(users, setup);
    await setup.owner.login();
    const url = dashboardUrl(setup.workspaceId, setup.dashboardId);
    await page.goto(url);

    await addFilterRule(page, { field: "Sentiment", operator: "is", value: "Negative" });
    await page.getByRole("button", { name: "Lock for everyone" }).click();
    await expect(page.getByText("Filters locked for everyone who opens this dashboard")).toBeVisible();

    // Locking moves the filter off the editor's own: one locked chip, and the URL pins nothing.
    await expect(lockedChip(page, /Sentiment: Negative, locked/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Lock for everyone" })).toHaveCount(0);
    await expect.poll(() => urlFilters(page).rule).toBeNull();
    const stored = await prisma.dashboard.findUniqueOrThrow({ where: { id: setup.dashboardId } });
    expect(stored.filters).toEqual([
      expect.objectContaining({
        field: SENTIMENT_FIELD,
        operator: "equals",
        label: "Sentiment",
        values: ["negative"],
      }),
    ]);

    // The viewer, in a browser of its own, sees the same chip locked, with no way to take it off.
    const viewerContext = await browser.newContext();
    try {
      const viewerPage = await viewerContext.newPage();
      await loginOn(viewerPage, viewer.id);
      await viewerPage.goto(url);
      await expect(viewerPage.getByText(setup.chartName)).toBeVisible();
      await expect(lockedChip(viewerPage, /Sentiment: Negative, locked/)).toBeVisible();
      await expect(filterChips(viewerPage).getByRole("button", { name: /^(Unlock|Remove) / })).toHaveCount(0);
    } finally {
      await viewerContext.close();
    }

    // The editor unlocks it, and the dashboard holds no filter again.
    await filterChips(page)
      .getByRole("button", { name: /^Unlock .*Sentiment/ })
      .click();
    await expect(page.getByText("Filter unlocked for everyone")).toBeVisible();
    await expect(filterChips(page)).toHaveCount(0);
    await expect
      .poll(
        async () => (await prisma.dashboard.findUniqueOrThrow({ where: { id: setup.dashboardId } })).filters
      )
      .toEqual([]);
  });
});

// Dashboard filters against real chart data: feedback records in Formbricks Hub, queried through Cube with
// this branch's model. CI starts neither service, so these tests skip at run time without them (the
// `@hub-cube` tag names the dependency); run them locally with Hub and Cube up.
//
// One organization is seeded once for the block — thousands of records are too slow to write per test.
// Personal filters are each person's own (URL and cookie); a test that locks one puts the dashboard back.

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
  embeddedMembers: Record<string, string>;
}

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
        data: { name, type: "bar", workspaceId, feedbackDirectoryId, createdBy: owner.id, query, config: {} },
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

  const dashboardName = `Field force ${suffix}`;
  const order = [charts.visits, charts.reviews, charts.byProduct, charts.late, charts.empty];
  const dashboard = await prisma.dashboard.create({
    data: {
      name: dashboardName,
      workspaceId,
      createdBy: owner.id,
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
    embeddedMembers,
  };
};

const widget = (page: Page, chartName: string) =>
  page.locator(".react-grid-item").filter({ has: page.getByText(chartName, { exact: true }) });

/** A widget's numbers in its Data view, which reads them as a table rather than as bars. */
const showData = async (page: Page, chartName: string) => {
  await widget(page, chartName).getByRole("button", { name: "Data" }).click();
};

/** A single-number widget's Data view ends with its count, as the app formats it ("3,000"). */
const expectCount = async (page: Page, chartName: string, count: number) =>
  expect(widget(page, chartName)).toContainText(
    new RegExp(`Feedback Records${count.toLocaleString("en-US")}$`)
  );

/** The dashboard's URL with personal filters pinned, as a shared link carries them. */
const filteredUrl = (s: Seeded, filters: { key: string; value: string }[]) => {
  const params = new URLSearchParams();
  filters.forEach(({ key, value }, index) => {
    params.append(`filter[f${index + 1}]`, `equals:${s.embeddedMembers[key]}`);
    params.append(`picks[f${index + 1}]`, value);
  });
  return `${dashboardUrl(s.workspaceId, s.dashboardId)}?${params.toString()}`;
};

test.describe("Dashboard filters on chart data @hub-cube", () => {
  test.describe.configure({ mode: "serial" });

  let seeded: Seeded | undefined;
  let reachable = false;

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

  test.beforeEach(({}, testInfo) => {
    testInfo.skip(
      !reachable,
      "Needs Formbricks Hub and Cube (HUB_API_URL, CUBEJS_API_URL); CI starts neither."
    );
  });

  test("a filter narrows every chart, and a chart whose dataset lacks the field says so", async ({
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

    // The value is picked from the values the charts hold, looked up when the list opens.
    await addFilterRule(page, { field: "Area Manager", operator: "is", value: "Bianchi" });

    // Visits with s % 4 == 1; reviews likewise; late visits are s % 20 == 5.
    await expectCount(page, "Visits", 750);
    await expectCount(page, "Store reviews", REVIEWS / 4);
    await expectCount(page, "Visits where delivery was late", 150);

    // A shared link pins a Rep too: one visit, and the reviews have no Rep to filter by.
    await page.goto(
      filteredUrl(s, [
        { key: "Area Manager", value: "Bianchi" },
        { key: "Rep", value: repOf(1) },
      ])
    );
    for (const name of ["Visits", "Store reviews"]) await showData(page, name);
    await expectCount(page, "Visits", 1);
    await expect(widget(page, "Store reviews")).toContainText("This chart can't be filtered by Rep");
  });

  test("a value list narrows by the other filters and asks to refine a long list", async ({
    page,
    users,
  }) => {
    const s = seeded!;
    const viewer = await addDashboardViewer(users, s);
    await viewer.login();
    await page.goto(dashboardUrl(s.workspaceId, s.dashboardId));
    await expect(widget(page, "Visits")).toBeVisible();

    const openRepValues = async () => {
      await page.getByTestId("table-filter-button").click();
      await page.getByRole("menuitem", { name: "Advanced filter" }).click();
      const dialog = page.getByRole("dialog", { name: "Advanced filter" });
      const rows = await dialog.locator("[id$='-conditionOperator']").count();
      const firstRowEmpty =
        (await dialog.locator("#condition-0-0-conditionOperator").innerText()).trim() === "";
      const index = firstRowEmpty ? 0 : rows;
      if (!firstRowEmpty) await dialog.getByRole("button", { name: "Add filter" }).click();
      await dialog.locator(`#condition-0-${index}-conditionValue`).click();
      await page.getByRole("option", { name: "Rep", exact: true }).click();
      await dialog.getByRole("button", { name: "Rep value" }).click();
      return dialog;
    };

    // Thousands of reps: the first page, and a hint to search for the rest.
    let dialog = await openRepValues();
    await expect(page.getByText(/Showing the first \d+ values\. Search to find more\./)).toBeVisible();
    await page.getByRole("textbox", { name: "Search Rep values" }).fill(repOf(2999));
    await expect(page.getByRole("option", { name: repOf(2999), exact: true })).toBeVisible();
    await expect(page.getByText(/Search to find more/)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // With an Area Manager set, the Rep list holds only that manager's reps.
    await page.goto(filteredUrl(s, [{ key: "Area Manager", value: "Conti" }]));
    await expect(filterChips(page)).toContainText("Conti");
    dialog = await openRepValues();
    const options = page.getByRole("option").filter({ hasText: /^Rep \d{4}$/ });
    await expect(options.first()).toBeVisible();
    for (const name of await options.allTextContents()) {
      expect(Number(name.replace("Rep ", "")) % AREA_MANAGERS.length, `${name} belongs to Conti`).toBe(2);
    }
    await page.getByRole("textbox", { name: "Search Rep values" }).fill(repOf(1));
    await expect(page.getByRole("option", { name: repOf(1), exact: true })).toHaveCount(0);
  });

  test("a chart grouped by one embedded field and filtered by another, with an awkward key name", async ({
    page,
  }) => {
    const s = seeded!;
    await loginOn(page, s.owner.id);
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

  test("an owner filters on a key with an awkward name, and the charts narrow", async ({ page }) => {
    const s = seeded!;
    await loginOn(page, s.owner.id);
    await page.goto(dashboardUrl(s.workspaceId, s.dashboardId));
    await showData(page, "Visits");
    await expectCount(page, "Visits", 3000);

    await addFilterRule(page, { field: "région/zone", operator: "is", value: "Sud" });
    await expectCount(page, "Visits", 1500);
    // The reviews dataset has no zone at all.
    await showData(page, "Store reviews");
    await expect(widget(page, "Store reviews")).toContainText("This chart can't be filtered by région/zone");
  });

  test("a filter an editor locks narrows a viewer's charts", async ({ page, users }) => {
    const s = seeded!;
    const locked: SeedLockedFilter = {
      id: createId(),
      field: s.embeddedMembers["Area Manager"],
      operator: "equals",
      label: "Area Manager",
      values: ["Greco"],
    };
    await prisma.dashboard.update({ where: { id: s.dashboardId }, data: { filters: [locked] as never } });
    try {
      const viewer = await addDashboardViewer(users, s);
      await viewer.login();
      await page.goto(dashboardUrl(s.workspaceId, s.dashboardId));
      await expect(lockedChip(page, /Area Manager.*Greco, locked/)).toBeVisible();
      await showData(page, "Visits");
      // Visits with s % 4 == 3.
      await expectCount(page, "Visits", 750);
    } finally {
      // Leave the shared dashboard as the other tests expect it.
      await prisma.dashboard.update({ where: { id: s.dashboardId }, data: { filters: [] } });
    }
  });
});
