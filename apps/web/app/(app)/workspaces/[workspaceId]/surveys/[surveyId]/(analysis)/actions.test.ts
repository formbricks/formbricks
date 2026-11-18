import { describe, expect, test, vi } from "vitest";

const captured = vi.hoisted(() => ({
  schemas: [] as { safeParse: (v: unknown) => { success: boolean } }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: (schema: (typeof captured.schemas)[number]) => {
      captured.schemas.push(schema);
      return { action: (handler: object) => handler };
    },
  },
}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/display/service", () => ({ getDisplaysBySurveyIdWithContact: vi.fn() }));
vi.mock("@/lib/response/service", () => ({ getResponseCountBySurveyId: vi.fn(), getResponses: vi.fn() }));
vi.mock("./summary/lib/surveySummary", () => ({ getSurveySummary: vi.fn() }));

describe("getResponsesAction input bounds", () => {
  test("bounds limit and offset", async () => {
    await import("./actions");
    const schema = captured.schemas[0];
    const surveyId = "clh0a1b2c3d4e5f6g7h8i9j0k";
    const ok = (extra: object) => schema.safeParse({ surveyId, ...extra }).success;

    expect(ok({})).toBe(true);
    expect(ok({ limit: 25, offset: 0 })).toBe(true);
    expect(ok({ limit: 100 })).toBe(true);
    expect(ok({ limit: 101 })).toBe(false);
    expect(ok({ limit: 10_000_000 })).toBe(false);
    expect(ok({ limit: 0 })).toBe(false);
    expect(ok({ limit: 1.5 })).toBe(false);
    expect(ok({ offset: -1 })).toBe(false);
  });
});
