import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSingleCondition } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import {
  getActionValueOptions,
  getActionVariableOptions,
  getConditionOperatorOptions,
  getConditionValueOptions,
  getMatchValueProps,
} from "./utils";

/**
 * Returns the key, so an assertion on a group heading names the key it renders through rather than
 * the English words behind it — and a heading that came out as words is one that skipped `t()`.
 */
const t = ((key: string) => key) as unknown as TFunction;

const field = (
  overrides: Partial<TLinkedEmbeddedField["field"]> & { storageKey: string }
): TLinkedEmbeddedField => {
  const { storageKey, ...fieldOverrides } = overrides;
  return {
    field: {
      key: null,
      name: storageKey,
      source: "ingested",
      dataType: "string",
      defaultValue: null,
      locked: false,
      ...fieldOverrides,
    },
    link: { storageKey },
  };
};

const survey = (embeddedFields: TLinkedEmbeddedField[] = []): TSurvey =>
  ({
    id: "survey1",
    endings: [],
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          {
            id: "q_text",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Your name?" },
            required: false,
            inputType: "text",
            charLimit: { enabled: false },
          },
          {
            id: "q_number",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "How many seats?" },
            required: false,
            inputType: "number",
            charLimit: { enabled: false },
          },
          {
            id: "q_date",
            type: TSurveyElementTypeEnum.Date,
            headline: { default: "When?" },
            required: false,
            format: "M-d-y",
          },
        ],
      },
    ],
    embeddedFields,
  }) as unknown as TSurvey;

const condition = (
  leftOperand: TSingleCondition["leftOperand"],
  operator: TSingleCondition["operator"] = "equals"
): TSingleCondition => ({ id: "c1", leftOperand, operator }) as TSingleCondition;

const groupLabels = (groups: TComboboxGroupedOption[]): string[] => groups.map((group) => group.label);

const groupNamed = (groups: TComboboxGroupedOption[], label: string): TComboboxGroupedOption | undefined =>
  groups.find((group) => group.label === label);

const operatorValues = (options: TComboboxOption[]): (string | number)[] =>
  options.map((option) => option.value);

describe("getConditionValueOptions", () => {
  const mixed = survey([
    field({ storageKey: "plan", name: "Plan tier", key: "plan_tier" }),
    field({ storageKey: "score", name: "Score", source: "computed", dataType: "number" }),
    field({ storageKey: "ref", name: "Referrer" }),
  ]);

  test("draws three groups: questions, one Embedded Data group, auto-captured", () => {
    // ENG-1853's whole point. Before it this picker drew four — Questions, Variables, Hidden fields,
    // Survey data — and which of the middle two a field landed in was a storage detail the author
    // had never chosen.
    expect(groupLabels(getConditionValueOptions(mixed, t, undefined, true))).toEqual([
      "common.questions",
      "common.embedded_data",
      "common.auto_captured",
    ]);
  });

  test("the Embedded Data group holds both sources, in the definitions' order, keyed by storage key", () => {
    const embedded = groupNamed(getConditionValueOptions(mixed, t), "common.embedded_data");

    expect(embedded?.options).toEqual([
      expect.objectContaining({ label: "Plan tier", value: "plan" }),
      expect.objectContaining({ label: "Score", value: "score" }),
      expect.objectContaining({ label: "Referrer", value: "ref" }),
    ]);
  });

  test("merging the groups does not merge the stored operand types", () => {
    // `ConditionsEditor` copies `meta` straight onto `leftOperand.type`, and the runtime evaluator
    // and `getConditionOperatorOptions` both dispatch on it. One merged type here would rewrite every
    // condition an author touches into something neither can read.
    const embedded = groupNamed(getConditionValueOptions(mixed, t), "common.embedded_data");

    expect(embedded?.options.map((option) => option.meta?.type)).toEqual([
      "hiddenField",
      "variable",
      "hiddenField",
    ]);
  });

  test("only a shared field carries its library key beside the name", () => {
    const embedded = groupNamed(getConditionValueOptions(mixed, t), "common.embedded_data");

    expect(embedded?.options[0].meta?.hint).toBe("plan_tier");
    expect(embedded?.options[1].meta?.hint).toBeUndefined();
  });

  test("a blank name falls back to the storage key rather than drawing an unreadable row", () => {
    const embedded = groupNamed(
      getConditionValueOptions(survey([field({ storageKey: "plan", name: "  " })]), t),
      "common.embedded_data"
    );

    expect(embedded?.options).toEqual([expect.objectContaining({ label: "plan", value: "plan" })]);
  });

  test("auto-captured fields are labelled the way every other surface labels them", () => {
    // `Url`, title-cased from the catalog name, is what this picker showed before ENG-1853 — beside a
    // response table calling the same field `URL`.
    const autoCaptured = groupNamed(
      getConditionValueOptions(mixed, t, undefined, true),
      "common.auto_captured"
    );

    expect(autoCaptured?.options.map((option) => option.label)).toContain("common.url");
    expect(autoCaptured?.options.every((option) => option.meta?.type === "reserved")).toBe(true);
  });

  test("the auto-captured group is opt-in, because quota conditions project no reserved values", () => {
    expect(groupLabels(getConditionValueOptions(mixed, t))).toEqual([
      "common.questions",
      "common.embedded_data",
    ]);
  });

  test("a survey with no Embedded Data draws no empty heading", () => {
    expect(groupLabels(getConditionValueOptions(survey(), t))).toEqual(["common.questions"]);
  });
});

describe("getConditionOperatorOptions", () => {
  const typed = survey([
    field({ storageKey: "plan" }),
    field({ storageKey: "seats", dataType: "number" }),
    field({ storageKey: "is_trial", dataType: "boolean" }),
    field({ storageKey: "signed_up", dataType: "date" }),
  ]);

  const operatorsFor = (storageKey: string): (string | number)[] =>
    operatorValues(
      getConditionOperatorOptions(condition({ type: "hiddenField", value: storageKey }), typed, t)
    );

  test("a string field keeps every operator a hidden field had before it was typed", () => {
    // The legacy-parity claim: every ingested field a legacy survey holds is a `string`, and this is
    // exactly the list the retired `hiddenField` rule family held.
    expect(operatorsFor("plan")).toEqual([
      "equals",
      "doesNotEqual",
      "contains",
      "doesNotContain",
      "startsWith",
      "doesNotStartWith",
      "endsWith",
      "doesNotEndWith",
      "isSet",
      "isNotSet",
    ]);
  });

  test("a number field gets ordering instead of substring matching", () => {
    expect(operatorsFor("seats")).toContain("isGreaterThan");
    expect(operatorsFor("seats")).not.toContain("contains");
  });

  test("a boolean field gets equality only", () => {
    expect(operatorsFor("is_trial").toSorted()).toStrictEqual(
      ["equals", "doesNotEqual", "isSet", "isNotSet"].toSorted()
    );
  });

  test("a date field gets chronological comparison", () => {
    expect(operatorsFor("signed_up")).toContain("isBefore");
    expect(operatorsFor("signed_up")).toContain("isAfter");
  });

  test("a condition pointing at a deleted field falls back to the widest safe set", () => {
    // A condition outlives the field it points at, and an operand with no operators at all would
    // strand the author in a row they can neither complete nor understand.
    expect(operatorsFor("deleted_field")).toContain("contains");
  });

  test("an auto-captured field is keyed by the catalog's dataType, not by its name", () => {
    expect(
      operatorValues(getConditionOperatorOptions(condition({ type: "reserved", value: "url" }), typed, t))
    ).toContain("contains");
    expect(
      operatorValues(
        getConditionOperatorOptions(condition({ type: "reserved", value: "screenWidth" }), typed, t)
      )
    ).toContain("isGreaterThan");
  });
});

describe("getMatchValueProps", () => {
  const typed = survey([
    field({ storageKey: "plan", name: "Plan" }),
    field({ storageKey: "seats", name: "Seats", dataType: "number" }),
    field({ storageKey: "is_trial", name: "Is trial", dataType: "boolean" }),
    field({ storageKey: "signed_up", name: "Signed up", dataType: "date" }),
    field({ storageKey: "score", name: "Score", source: "computed", dataType: "number" }),
  ]);

  const propsFor = (storageKey: string, operator: TSingleCondition["operator"] = "equals") =>
    getMatchValueProps(condition({ type: "hiddenField", value: storageKey }, operator), typed, t);

  test("a boolean field offers the two stored spellings and no free-text box", () => {
    // They are stored as the strings "true"/"false", so typing the word was the only way to write
    // this condition before — and a typo produced a row that read correctly and never matched.
    const props = propsFor("is_trial");

    expect(props.showInput).toBe(false);
    expect(props.options).toEqual([
      {
        label: "common.choices",
        value: "choices",
        options: [
          { label: "common.true", value: "true", meta: { type: "static" } },
          { label: "common.false", value: "false", meta: { type: "static" } },
        ],
      },
    ]);
  });

  test("a date field asks for a date, not free text", () => {
    const props = propsFor("signed_up");

    expect(props.showInput).toBe(true);
    expect(props.inputType).toBe("date");
    // Only an element that answers with a date can be compared to one.
    expect(groupNamed(props.options, "common.questions")?.options).toEqual([
      expect.objectContaining({ value: "q_date" }),
    ]);
  });

  test("the input type follows the field's declared type", () => {
    expect(propsFor("plan").inputType).toBe("text");
    expect(propsFor("seats").inputType).toBe("number");
  });

  test("a legacy string field is still comparable against a numeric operand", () => {
    // Untyped by construction — every field a legacy survey holds is a `string` and the old lists
    // never filtered them — so narrowing this would silently drop rows from surveys in the wild.
    const embedded = groupNamed(propsFor("seats").options, "common.embedded_data");

    expect(embedded?.options.map((option) => option.value)).toEqual(["plan", "score"]);
  });

  test("a field that declares a narrower type is held to it", () => {
    // `is_trial` and `signed_up` cannot be compared to a number, and `seats` is the operand itself.
    const embedded = groupNamed(propsFor("seats").options, "common.embedded_data");

    expect(embedded?.options.map((option) => option.value)).not.toContain("is_trial");
    expect(embedded?.options.map((option) => option.value)).not.toContain("signed_up");
  });

  test("the operand on the left is never offered on the right", () => {
    // Comparing a field to itself is never a useful condition, and the exclusion has to survive the
    // group merge: it used to be applied once per group, by three separate branches.
    const twoStrings = survey([
      field({ storageKey: "plan", name: "Plan" }),
      field({ storageKey: "ref", name: "Referrer" }),
    ]);
    const props = getMatchValueProps(condition({ type: "hiddenField", value: "plan" }), twoStrings, t);

    expect(groupNamed(props.options, "common.embedded_data")?.options.map((option) => option.value)).toEqual([
      "ref",
    ]);
  });

  test("a group with nothing left in it is dropped rather than drawn empty", () => {
    // Every other field here declares a narrower type than `plan`, so the Embedded Data group has no
    // rows at all — a heading over nothing is worse than no heading.
    expect(groupLabels(propsFor("plan").options)).not.toContain("common.embedded_data");
  });

  test("an operator that needs no right-hand side asks for none", () => {
    expect(propsFor("plan", "isSet")).toEqual({ show: false, options: [] });
  });

  test("an auto-captured operand also offers other auto-captured fields of its own type", () => {
    const props = getMatchValueProps(condition({ type: "reserved", value: "url" }), typed, t);
    const autoCaptured = groupNamed(props.options, "common.auto_captured");

    expect(autoCaptured?.options.map((option) => option.value)).toContain("pagePath");
    expect(autoCaptured?.options.map((option) => option.value)).not.toContain("url");
    expect(autoCaptured?.options.map((option) => option.value)).not.toContain("screenWidth");
  });
});

describe("calculate action options", () => {
  const typed = survey([
    field({ storageKey: "plan", name: "Plan" }),
    field({ storageKey: "score", name: "Score", source: "computed", dataType: "number", key: "score_key" }),
    field({ storageKey: "note", name: "Note", source: "computed", dataType: "string" }),
  ]);

  test("only computed fields can be assigned to, and a shared one shows its library key", () => {
    // There is nothing to assign to an ingested field: its value arrives from outside the survey.
    expect(getActionVariableOptions(typed)).toEqual([
      expect.objectContaining({
        value: "score",
        label: "Score",
        meta: { variableType: "number", hint: "score_key" },
      }),
      expect.objectContaining({ value: "note", label: "Note", meta: { variableType: "text" } }),
    ]);
  });

  test("the value picker draws the same Embedded Data group, with no auto-captured one", () => {
    // `evaluateLogic` computes these assignments from `responseData` and variables alone, so a
    // reserved value offered here would read as unset every time.
    const groups = getActionValueOptions("note", typed, 0, t);

    expect(groupLabels(groups)).toEqual(["common.questions", "common.embedded_data"]);
    expect(groupNamed(groups, "common.embedded_data")?.options.map((option) => option.value)).toEqual([
      "plan",
    ]);
  });

  test("assigning to a number field only offers values that can be numbers", () => {
    const groups = getActionValueOptions("score", typed, 0, t);

    expect(groupNamed(groups, "common.questions")?.options.map((option) => option.value)).toEqual([
      "q_number",
    ]);
    // The legacy string field stays comparable; the text variable does not.
    expect(groupNamed(groups, "common.embedded_data")?.options.map((option) => option.value)).toEqual([
      "plan",
    ]);
  });
});

describe("dataType coverage", () => {
  test("every Embedded Data type produces a usable right-hand side", () => {
    // A missing arm shows as a condition the author can select and then never complete, which is
    // invisible until someone builds one — so this walks the schema's own list rather than a copy.
    const dataTypes: TEmbeddedDataType[] = ["string", "number", "boolean", "date"];

    for (const dataType of dataTypes) {
      const localSurvey = survey([field({ storageKey: "f", dataType })]);
      const props = getMatchValueProps(condition({ type: "hiddenField", value: "f" }), localSurvey, t);

      expect(props.show).toBe(true);
      expect(props.showInput === true || props.options.length > 0).toBe(true);
    }
  });
});
