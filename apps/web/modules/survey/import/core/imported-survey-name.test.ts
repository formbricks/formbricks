import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import enUS from "@/locales/en-US.json";
import { SURVEY_IMPORT_MAX_NAME_CHARS, SURVEY_IMPORT_MAX_TAKEN_NAMES } from "../limits";
import { getImportedSurveyName } from "./imported-survey-name";

vi.mock("@/lib/user/locale", () => ({ getUserLocaleOrDefault: vi.fn() }));
vi.mock("@/lingodotdev/server", () => ({ getTranslate: vi.fn() }));

const t = (key: string, options?: Record<string, unknown>): string =>
  (key === "common.imported_suffix"
    ? enUS.common.imported_suffix
    : enUS.common.imported_suffix_number
  ).replace("{number}", String(options?.number ?? ""));

const WORKSPACE_ID = "clworkspace0000000000001";

describe("getImportedSurveyName", () => {
  beforeEach(() => {
    vi.mocked(prisma.survey.findMany).mockReset();
  });

  test("reads only the names a candidate can have, a bounded number of them, and takes the lowest free one", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      { name: "Onboarding (imported)" },
      { name: "Onboarding (imported 2)" },
    ] as never);

    expect(await getImportedSurveyName(WORKSPACE_ID, "Onboarding (imported)", t)).toBe(
      "Onboarding (imported 3)"
    );
    expect(vi.mocked(prisma.survey.findMany).mock.calls[0][0]).toEqual({
      where: { workspaceId: WORKSPACE_ID, name: { startsWith: "Onboarding (imported" } },
      select: { name: true },
      take: SURVEY_IMPORT_MAX_TAKEN_NAMES,
    });
  });

  test("escapes the name for the lookup, so a backslash or wildcard in it matches itself", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);

    await getImportedSurveyName(WORKSPACE_ID, String.raw`Q3 \ Q4 100%_done`, t);

    expect(vi.mocked(prisma.survey.findMany).mock.calls[0][0]?.where?.name).toEqual({
      startsWith: String.raw`Q3 \\ Q4 100\%\_done (imported`,
    });
  });

  test("cuts the name to 200 characters before the suffix, whichever lane it came from", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);

    const name = await getImportedSurveyName(WORKSPACE_ID, "a".repeat(300), t);

    expect(name).toBe(`${"a".repeat(SURVEY_IMPORT_MAX_NAME_CHARS)} (imported)`);
  });

  test("cuts an imported name's own suffix off first, and never splits an emoji at the cut", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);
    // The emoji's two units sit across the 200th character.
    const long = `${"b".repeat(SURVEY_IMPORT_MAX_NAME_CHARS - 1)}😀 tail (imported 4)`;

    expect(await getImportedSurveyName(WORKSPACE_ID, long, t)).toBe(
      `${"b".repeat(SURVEY_IMPORT_MAX_NAME_CHARS - 1)} (imported)`
    );
  });
});
