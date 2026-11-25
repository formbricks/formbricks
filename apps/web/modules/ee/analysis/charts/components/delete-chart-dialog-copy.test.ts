import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, test } from "vitest";
import en from "@/locales/en-US.json";

/**
 * The "chart still in use" dialog (`delete-chart-dialog.tsx`) passes the number of dashboards as `count`.
 * The app formats through `i18next-icu`, so the en-US string is read here the same way, with the
 * options i18next-icu uses (`ignoreTag`).
 */
const describeInUse = (count: number): string =>
  String(
    new IntlMessageFormat(en.workspace.analysis.charts.chart_in_use_description, "en-US", undefined, {
      ignoreTag: true,
    }).format({ count })
  );

describe("chart_in_use_description", () => {
  test("names one dashboard in the singular", () => {
    expect(describeInUse(1)).toBe("It is on 1 dashboard. Remove it from that dashboard before deleting it:");
  });

  test("names several dashboards in the plural", () => {
    expect(describeInUse(3)).toBe("It is on 3 dashboards. Remove it from them before deleting it:");
  });
});
