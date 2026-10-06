import type { TFunction } from "i18next";
import { ArrowDownToLineIcon, CalculatorIcon } from "lucide-react";
import { describe, expect, test } from "vitest";
import { ZEmbeddedDataSource, ZEmbeddedDataType } from "@formbricks/types/embedded-data";
import type { TReservedFieldPrivacy } from "@formbricks/types/embedded-data-resolver";
import { ZSurveyStatus } from "@formbricks/types/surveys/types";
import {
  SOURCE_ICONS,
  getAvailabilityLabel,
  getDataTypeLabel,
  getPrivacyLabel,
  getSourceLabel,
  getSurveyStatusLabel,
} from "./field-labels";

/** Returns the key, so an assertion names the key that renders rather than the English behind it. */
const t = ((key: string) => key) as unknown as TFunction;

/**
 * These are the words the page puts on a field's enum columns, and the privacy column is the one
 * where a wrong word is a wrong statement about what the product stores. Before this file the
 * mappers lived in a `.tsx`, where AGENTS.md's no-component-test rule and Sonar's `**‍/*.tsx`
 * coverage exclusion both applied — so swapping "Kept" and "Not stored" passed the whole suite.
 */
describe("getPrivacyLabel", () => {
  test("names each treatment with its own key", () => {
    expect(getPrivacyLabel("keep", t)).toBe("workspace.embedded_data.privacy_kept");
    expect(getPrivacyLabel("drop", t)).toBe("workspace.embedded_data.privacy_not_stored");
    expect(getPrivacyLabel("redactQuery", t)).toBe("workspace.embedded_data.privacy_query_removed");
  });

  test("gives each treatment a distinct key, so no two read the same", () => {
    // `TReservedFieldPrivacy` is a plain union, not a zod enum, so there is nothing to enumerate at
    // runtime — the switch is exhaustive by the type, and adding a treatment is a compile error.
    const privacies: TReservedFieldPrivacy[] = ["keep", "drop", "redactQuery"];
    const keys = privacies.map((privacy) => getPrivacyLabel(privacy, t));

    expect(new Set(keys).size).toBe(privacies.length);
  });
});

describe("getSourceLabel and SOURCE_ICONS", () => {
  test("a calculated field reads and draws differently from a passed-in one", () => {
    expect(getSourceLabel("computed", t)).toBe("workspace.embedded_data.source_calculated");
    expect(getSourceLabel("ingested", t)).toBe("workspace.embedded_data.source_passed_in");
    expect(SOURCE_ICONS.computed).toBe(CalculatorIcon);
    expect(SOURCE_ICONS.ingested).toBe(ArrowDownToLineIcon);
  });

  test("every source the schema names has a label, and no two share one", () => {
    const keys = ZEmbeddedDataSource.options.map((source) => getSourceLabel(source, t));

    expect(keys.filter((key) => key === undefined)).toEqual([]);
    expect(new Set(keys).size).toBe(ZEmbeddedDataSource.options.length);
  });
});

describe("getDataTypeLabel", () => {
  test("every data type has its own label", () => {
    const keys = ZEmbeddedDataType.options.map((dataType) => getDataTypeLabel(dataType, t));

    expect(keys.filter((key) => key === undefined)).toEqual([]);
    expect(new Set(keys).size).toBe(ZEmbeddedDataType.options.length);
  });

  test("the confirmation's from/to read as the badge the author just saw", () => {
    // The file's own promise: the dialog asks "Change X from Text to Number?" only if the table's
    // badge said "Text", which holds because both call this.
    expect(getDataTypeLabel("string", t)).toBe("common.text");
    expect(getDataTypeLabel("number", t)).toBe("common.number");
  });
});

describe("getAvailabilityLabel", () => {
  test("distinguishes a field usable mid-survey from one only known afterwards", () => {
    expect(getAvailabilityLabel("always", t)).toBe("common.yes");
    expect(getAvailabilityLabel("afterSubmit", t)).toBe("workspace.embedded_data.after_response_submitted");
  });
});

describe("getSurveyStatusLabel", () => {
  test("labels every status the schema allows, walked from the schema rather than a copy", () => {
    const keys = ZSurveyStatus.options.map((status) => getSurveyStatusLabel(status, t));

    expect(keys.filter((key) => key === undefined)).toEqual([]);
    expect(new Set(keys).size).toBe(ZSurveyStatus.options.length);
  });
});
