import { describe, expect, test } from "vitest";
import {
  AI_DATA_PROFILE_LIMITS,
  type TAIDataProfile,
  buildDataProfileQueries,
  collectDataProfile,
  formatDataProfile,
} from "./ai-data-profile";

const sourceRow = (name: string, type = "link") => ({
  "FeedbackRecords.sourceName": name,
  "FeedbackRecords.sourceType": type,
});

const questionRow = (label: string, fieldType = "rating") => ({
  "FeedbackRecords.fieldLabel": label,
  "FeedbackRecords.fieldType": fieldType,
});

const monthRow = (month: string, count: number | string) => ({
  "FeedbackRecords.collectedAt.month": `${month}-01T00:00:00.000`,
  "FeedbackRecords.count": count,
});

const emptyProfile: TAIDataProfile = {
  totalRecords: 0,
  sources: [],
  questions: [],
  languages: [],
  fieldTypes: [],
  earliestMonth: null,
  latestMonth: null,
  truncated: { sources: false, questions: false, languages: false },
};

describe("buildDataProfileQueries", () => {
  test("over-fetches one row past each cap so a full page can be reported as truncated", () => {
    const queries = buildDataProfileQueries();

    expect(queries.sources.limit).toBe(AI_DATA_PROFILE_LIMITS.sources + 1);
    expect(queries.questions.limit).toBe(AI_DATA_PROFILE_LIMITS.questions + 1);
    expect(queries.languages.limit).toBe(AI_DATA_PROFILE_LIMITS.languages + 1);
  });

  test("asks for monthly buckets so the timeline carries both the date range and the total", () => {
    const { timeline } = buildDataProfileQueries();

    expect(timeline.measures).toEqual(["FeedbackRecords.count"]);
    expect(timeline.timeDimensions).toEqual([
      { dimension: "FeedbackRecords.collectedAt", granularity: "month" },
    ]);
  });
});

describe("collectDataProfile", () => {
  test("reads sources, questions, languages and the date range off the cube rows", () => {
    const profile = collectDataProfile({
      sources: [sourceRow("Web widget prod", "app"), sourceRow("Email campaign", "link")],
      questions: [questionRow("How happy are you?", "rating"), questionRow("Any comments?", "text")],
      languages: [{ "FeedbackRecords.language": "en" }, { "FeedbackRecords.language": "de" }],
      timeline: [monthRow("2026-01", 10), monthRow("2026-03", 32)],
    });

    expect(profile.sources).toEqual([
      { name: "Web widget prod", type: "app" },
      { name: "Email campaign", type: "link" },
    ]);
    expect(profile.questions).toEqual([
      { label: "How happy are you?", fieldType: "rating" },
      { label: "Any comments?", fieldType: "text" },
    ]);
    expect(profile.languages).toEqual(["en", "de"]);
    expect(profile.fieldTypes).toEqual(["rating", "text"]);
    expect(profile.totalRecords).toBe(42);
    expect(profile.earliestMonth).toBe("2026-01");
    expect(profile.latestMonth).toBe("2026-03");
  });

  test("sums counts returned as strings, as some cube drivers do", () => {
    const profile = collectDataProfile({
      sources: [],
      questions: [],
      languages: [],
      timeline: [monthRow("2026-01", "10"), monthRow("2026-02", "5")],
    });

    expect(profile.totalRecords).toBe(15);
  });

  test("reads the bare time-dimension key when cube does not suffix the granularity", () => {
    const profile = collectDataProfile({
      sources: [],
      questions: [],
      languages: [],
      timeline: [{ "FeedbackRecords.collectedAt": "2026-05-01T00:00:00.000", "FeedbackRecords.count": 3 }],
    });

    expect(profile.earliestMonth).toBe("2026-05");
    expect(profile.totalRecords).toBe(3);
  });

  test("counts a question stored under two field types once, keeping both types available", () => {
    const profile = collectDataProfile({
      sources: [],
      questions: [questionRow("Rate us", "rating"), questionRow("Rate us", "nps")],
      languages: [],
      timeline: [],
    });

    expect(profile.questions).toEqual([{ label: "Rate us", fieldType: "rating" }]);
    // Which measures have data is a property of the directory, so the second type still counts.
    expect(profile.fieldTypes).toEqual(["nps", "rating"]);
  });

  test("keeps a source name that appears under two source types as two entries", () => {
    const profile = collectDataProfile({
      sources: [sourceRow("Onboarding", "app"), sourceRow("Onboarding", "link")],
      questions: [],
      languages: [],
      timeline: [],
    });

    expect(profile.sources).toHaveLength(2);
  });

  test("caps each list and flags it as truncated", () => {
    const overflow = AI_DATA_PROFILE_LIMITS.questions + 1;
    const profile = collectDataProfile({
      sources: [],
      questions: Array.from({ length: overflow }, (_, index) => questionRow(`Question ${index}`)),
      languages: [],
      timeline: [],
    });

    expect(profile.questions).toHaveLength(AI_DATA_PROFILE_LIMITS.questions);
    expect(profile.truncated.questions).toBe(true);
  });

  test("ignores blank and non-string values rather than emitting empty entries", () => {
    const profile = collectDataProfile({
      sources: [sourceRow("   ", "link"), { "FeedbackRecords.sourceName": 42 }, sourceRow("Real")],
      questions: [],
      languages: [],
      timeline: [],
    });

    expect(profile.sources).toEqual([{ name: "Real", type: "link" }]);
  });

  test("survives rows that are not arrays of objects", () => {
    const profile = collectDataProfile({
      sources: null,
      questions: "nope",
      languages: [null, undefined],
      timeline: undefined,
    });

    expect(profile).toEqual(emptyProfile);
  });
});

describe("formatDataProfile", () => {
  test("renders nothing when the directory could not be profiled", () => {
    expect(formatDataProfile(null)).toBe("");
  });

  test("says the dataset is empty rather than listing nothing", () => {
    const section = formatDataProfile(emptyProfile);

    expect(section).toContain("holds no feedback records yet");
    expect(section).not.toContain("### Sources");
  });

  test("lists the real values and the date range", () => {
    const section = formatDataProfile({
      ...emptyProfile,
      totalRecords: 42,
      sources: [{ name: "Web widget prod", type: "app" }],
      questions: [{ label: "How happy are you?", fieldType: "rating" }],
      languages: ["en"],
      fieldTypes: ["rating"],
      earliestMonth: "2026-01",
      latestMonth: "2026-09",
    });

    expect(section).toContain("- Web widget prod (app)");
    expect(section).toContain("- How happy are you? (rating)");
    expect(section).toContain("42 feedback records");
    expect(section).toContain("between 2026-01 and 2026-09");
  });

  test("tells the model a truncated list is not proof a value is absent", () => {
    const section = formatDataProfile({
      ...emptyProfile,
      totalRecords: 1,
      sources: [{ name: "Only listed" }],
      truncated: { sources: true, questions: false, languages: false },
    });

    expect(section).toContain("list truncated");
  });

  test("omits a section the directory has no values for", () => {
    const section = formatDataProfile({
      ...emptyProfile,
      totalRecords: 5,
      questions: [{ label: "Any comments?" }],
    });

    expect(section).toContain("### Questions");
    expect(section).not.toContain("### Sources");
    expect(section).not.toContain("### Languages");
  });
});
