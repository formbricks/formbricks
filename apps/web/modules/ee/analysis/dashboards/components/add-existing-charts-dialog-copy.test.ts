import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, test } from "vitest";
import en from "@/locales/en-US.json";

/**
 * The "Add charts" dialog (`add-existing-charts-dialog.tsx`) passes how many charts it adds, or failed to
 * add, as `count`. Read the way i18next-icu formats it (`ignoreTag`).
 */
const format = (message: string, count: number): string =>
  String(new IntlMessageFormat(message, "en-US", undefined, { ignoreTag: true }).format({ count }));

const { add_count_charts, charts_add_partial_failure } = en.workspace.analysis.dashboards;

describe("Add charts dialog copy", () => {
  test("the add button names one chart in the singular and several in the plural", () => {
    expect(format(add_count_charts, 1)).toBe("Add 1 chart");
    expect(format(add_count_charts, 4)).toBe("Add 4 charts");
  });

  test("the partial-failure toast names one chart in the singular and several in the plural", () => {
    expect(format(charts_add_partial_failure, 1)).toBe("Failed to add 1 chart");
    expect(format(charts_add_partial_failure, 2)).toBe("Failed to add 2 charts");
  });
});
