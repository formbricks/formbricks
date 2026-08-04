import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = process.env;

const setSchedulingEnv = (overrides: Record<string, string | undefined> = {}) => {
  process.env = {
    ...ORIGINAL_ENV,
    SURVEY_SCHEDULING_TIME_ZONE: undefined,
    SURVEY_SCHEDULING_LOCAL_HOUR: undefined,
    SURVEY_SCHEDULING_LOCAL_MINUTE: undefined,
    ...overrides,
  };
};

describe("survey scheduling constants", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test("defaults to Europe/Berlin at midnight when env vars are unset", async () => {
    setSchedulingEnv();

    const constants = await import("./constants");

    expect(constants.SURVEY_SCHEDULING_CONFIG).toEqual({
      timeZone: "Europe/Berlin",
      localHour: 0,
      localMinute: 0,
    });
    expect(constants.SURVEY_SCHEDULING_TIME_LABEL).toBe("00:00");
    expect(constants.SURVEY_SCHEDULING_DAILY_CRON_PATTERN).toBe("0 0 * * *");
  });

  test("reads a valid runtime configuration from server-side env vars", async () => {
    setSchedulingEnv({
      SURVEY_SCHEDULING_TIME_ZONE: "America/New_York",
      SURVEY_SCHEDULING_LOCAL_HOUR: "18",
      SURVEY_SCHEDULING_LOCAL_MINUTE: "45",
    });

    const constants = await import("./constants");

    expect(constants.SURVEY_SCHEDULING_CONFIG).toEqual({
      timeZone: "America/New_York",
      localHour: 18,
      localMinute: 45,
    });
    expect(constants.SURVEY_SCHEDULING_TIME_LABEL).toBe("18:45");
    expect(constants.SURVEY_SCHEDULING_DAILY_CRON_PATTERN).toBe("45 18 * * *");
  });
});
