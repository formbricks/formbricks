import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TExportRequest } from "@/lib/analysis-export/export-request";
import { EXCEL_MAX_WAITERS, EXCEL_WAIT_MS, excelBuildLimiter, handleExportRequest } from "./handle-export";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getAuthorizedV3Survey: vi.fn(),
  can: vi.fn(),
  checkRateLimit: vi.fn(),
  getOrganization: vi.fn(),
  getIsQuotasEnabled: vi.fn(),
  buildExportResponse: vi.fn(),
  countExportResponses: vi.fn(),
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@/app/api/v3/surveys/authorization", () => ({ getAuthorizedV3Survey: mocks.getAuthorizedV3Survey }));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/core/rate-limit/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsQuotasEnabled: mocks.getIsQuotasEnabled }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("./export-response", () => ({
  buildExportResponse: mocks.buildExportResponse,
  countExportResponses: mocks.countExportResponses,
  ExportCancelledError: class ExportCancelledError extends Error {},
}));

const survey = { id: "survey1", name: "Survey", workspaceId: "ws1" };
const authentication = { user: { id: "user1" } } as never;
const forbidden = new Response("forbidden", { status: 403 });
const defaults: TExportRequest = {
  format: "csv",
  display: "text",
  spss: false,
  advanced: [],
  excludedColumns: [],
  zip: false,
};

const run = (overrides: Partial<Parameters<typeof handleExportRequest>[0]> = {}) =>
  handleExportRequest({
    surveyId: "survey1",
    body: { ...defaults },
    dryRun: false,
    authentication,
    signal: new AbortController().signal,
    requestId: "req1",
    instance: "/api/surveys/survey1/export",
    ...overrides,
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getAuthorizedV3Survey.mockResolvedValue({
    survey,
    authResult: { organizationId: "org1", workspaceId: "ws1" },
    response: null,
  });
  mocks.can.mockResolvedValue(true);
  mocks.checkRateLimit.mockResolvedValue({ ok: true, data: { allowed: true } });
  mocks.getOrganization.mockResolvedValue({ displayTimeZone: "Europe/Berlin" });
  mocks.getIsQuotasEnabled.mockResolvedValue(false);
  mocks.buildExportResponse.mockResolvedValue({ ok: true, response: new Response("file") });
  mocks.countExportResponses.mockResolvedValue({ included: 7, lowQualityLeftOut: 2 });
});

describe("handleExportRequest authorization and scoping", () => {
  test("a survey the caller cannot read answers with the authorization response and exports nothing", async () => {
    mocks.getAuthorizedV3Survey.mockResolvedValue({ survey: null, authResult: null, response: forbidden });
    expect(await run()).toBe(forbidden);
    expect(mocks.buildExportResponse).not.toHaveBeenCalled();
    expect(mocks.countExportResponses).not.toHaveBeenCalled();
  });

  test("read access alone is not enough: survey.response_export is checked on the survey", async () => {
    mocks.can.mockResolvedValue(false);
    const response = await run();
    expect(response.status).toBe(403);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: "user1" }, "survey.response_export", {
      type: "survey",
      id: "survey1",
    });
    expect(mocks.buildExportResponse).not.toHaveBeenCalled();
  });

  test("the survey is loaded for read access, so a read-only seat can export", async () => {
    await run();
    expect(mocks.getAuthorizedV3Survey).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: "survey1", access: "read" })
    );
    expect(mocks.buildExportResponse).toHaveBeenCalled();
  });

  test("an unauthenticated request has no actor and is refused", async () => {
    expect((await run({ authentication: null })).status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("the export is scoped to the path's survey; selected ids travel in the filter", async () => {
    const filter = { responseIds: ["clxxxxxxxxxxxxxxxxxxxxxxx"] };
    await run({ body: { ...defaults, filter } });
    expect(mocks.buildExportResponse).toHaveBeenCalledWith(
      expect.objectContaining({ survey, filter, timeZone: "Europe/Berlin", isQuotasAllowed: false })
    );
  });
});

describe("handleExportRequest outcomes", () => {
  test("the defaults are planned as the Standard export", async () => {
    await run();
    expect(mocks.buildExportResponse).toHaveBeenCalledWith(
      expect.objectContaining({ plan: { kind: "standard", format: "csv" } })
    );
  });

  test("dryRun answers the counts, writes no file, spends no rate limit and audits a query", async () => {
    const auditLog = { action: "exported" } as never;
    const response = await run({ dryRun: true, auditLog });
    expect(await response.json()).toEqual({ data: { included: 7, lowQualityLeftOut: 2, kind: "standard" } });
    expect(mocks.buildExportResponse).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect((auditLog as { action: string }).action).toBe("queried");
  });

  test("dryRun passes the quota licence on and returns the Excel size the counts report", async () => {
    mocks.getIsQuotasEnabled.mockResolvedValue(true);
    const excel = { cells: 1_200_000, maxCells: 1_000_000, tooLarge: true };
    mocks.countExportResponses.mockResolvedValue({ included: 7, lowQualityLeftOut: 0, excel });
    const response = await run({ dryRun: true, body: { ...defaults, format: "xlsx", display: "codes" } });
    expect(mocks.countExportResponses).toHaveBeenCalledWith(
      expect.objectContaining({ isQuotasAllowed: true })
    );
    expect((await response.json()).data.excel).toEqual(excel);
  });

  test("over the rate limit the download is a 429", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: true, data: { allowed: false, retryAfter: 30 } });
    expect((await run()).status).toBe(429);
    expect(mocks.buildExportResponse).not.toHaveBeenCalled();
  });

  test("a workbook over the cell cap is a 422 with the reason", async () => {
    mocks.buildExportResponse.mockResolvedValue({ ok: false, reason: "excel_too_large", message: "too big" });
    const response = await run({ body: { ...defaults, format: "xlsx", display: "codes" } });
    expect(response.status).toBe(422);
    expect(await response.text()).toContain("too big");
  });

  test("only one Excel build runs per process: a second waits for the slot, CSV is not held back", async () => {
    vi.useFakeTimers();
    try {
      let finishBuild: (value: unknown) => void = () => {};
      mocks.buildExportResponse.mockImplementationOnce(
        () => new Promise((resolve) => (finishBuild = resolve))
      );
      const xlsx = { ...defaults, format: "xlsx" as const, display: "codes" as const };
      const first = run({ body: xlsx });
      await vi.advanceTimersByTimeAsync(0);
      expect(excelBuildLimiter.inFlight).toBe(1);

      const second = run({ body: xlsx });
      expect((await run()).status).toBe(200);
      await vi.advanceTimersByTimeAsync(500);
      expect(mocks.buildExportResponse).toHaveBeenCalledTimes(2); // the first, and the CSV

      finishBuild({ ok: true, response: new Response("file") });
      expect((await first).status).toBe(200);
      await vi.advanceTimersByTimeAsync(500);
      expect((await second).status).toBe(200);
      expect(excelBuildLimiter.inFlight).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test("an Excel export that waits too long, or finds the queue full, is a 429", async () => {
    vi.useFakeTimers();
    try {
      const held = excelBuildLimiter.tryAcquire();
      const xlsx = { ...defaults, format: "xlsx" as const, display: "codes" as const };

      const waiting = run({ body: xlsx });
      await vi.advanceTimersByTimeAsync(EXCEL_WAIT_MS + 1_000);
      expect((await waiting).status).toBe(429);

      const queued = Array.from({ length: EXCEL_MAX_WAITERS }, () => run({ body: xlsx }));
      await vi.advanceTimersByTimeAsync(0);
      expect((await run({ body: xlsx })).status).toBe(429);
      await vi.advanceTimersByTimeAsync(EXCEL_WAIT_MS + 1_000);
      expect((await Promise.all(queued)).map((response) => response.status)).toEqual(queued.map(() => 429));
      if (held.ok) held.release();
    } finally {
      vi.useRealTimers();
    }
  });

  test("a client that leaves while waiting for the slot is a 499 and frees its place", async () => {
    vi.useFakeTimers();
    try {
      const held = excelBuildLimiter.tryAcquire();
      const controller = new AbortController();
      const xlsx = { ...defaults, format: "xlsx" as const, display: "codes" as const };
      const waiting = run({ body: xlsx, signal: controller.signal });
      await vi.advanceTimersByTimeAsync(300);
      controller.abort();
      await vi.advanceTimersByTimeAsync(300);
      expect((await waiting).status).toBe(499);
      expect(mocks.buildExportResponse).not.toHaveBeenCalled();
      if (held.ok) held.release();
    } finally {
      vi.useRealTimers();
    }
  });

  test("a failed Excel build gives its slot back", async () => {
    mocks.buildExportResponse.mockRejectedValueOnce(new Error("boom"));
    await expect(run({ body: { ...defaults, format: "xlsx", display: "codes" } })).rejects.toThrow("boom");
    expect(excelBuildLimiter.inFlight).toBe(0);
  });

  test("a download the client abandoned is a 499, not a server error", async () => {
    const { ExportCancelledError } = await import("./export-response");
    mocks.buildExportResponse.mockRejectedValue(new ExportCancelledError());
    expect((await run()).status).toBe(499);
  });

  test("a successful download is recorded once", async () => {
    const response = await run();
    expect(await response.text()).toBe("file");
    expect(mocks.capturePostHogEvent).toHaveBeenCalledTimes(1);
  });
});
