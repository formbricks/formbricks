import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSingleCondition } from "@formbricks/types/surveys/logic";
import {
  SURVEY_FLOW_FIXTURE_IDS,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import {
  START_LOGIC_USE_INDEX,
  findBlockUsedInLogic,
  findElementUse,
  findElementUsedInLogic,
  findEndingCardUsedInLogic,
  findHiddenFieldUse,
  findHiddenFieldUsedInLogic,
  findOptionUse,
  findOptionUsedInLogic,
  findVariableUse,
  findVariableUsedInLogic,
  getActionObjectiveOptions,
  getActionOperatorOptions,
  getActionValueOptions,
  getActionVariableOptions,
  getConditionOperatorOptions,
  getConditionValueOptions,
  getFormatLeftOperandValue,
  getFormatRightOperandValue,
  getMatchValueProps,
  isComputedDateField,
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

  test("a question reads 'q1 · question text' in the picker once it has a code (ENG-6790)", () => {
    const coded = structuredClone(mixed);
    const [first, second] = coded.blocks[0].elements;
    (first as { code?: string }).code = "name";
    (second as { code?: string }).code = "seats";

    const questions = groupNamed(getConditionValueOptions(coded, t), "common.questions");

    expect(questions?.options.map((option) => option.label)).toEqual([
      "name · Your name?",
      "seats · How many seats?",
      "When?",
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

  test("a server-derived field is not offered, because logic could never resolve it", () => {
    // ENG-1840's whole point, and it was pinned only through the recall picker's own copy of this
    // gate (`survey-reserved-fields.spec.ts`). This is the copy that feeds logic operands, calculate
    // targets, redirect URL and follow-up recipients: a `country` row here reads as a condition that
    // silently never matches, because the value is derived server-side after the survey is answered.
    const labels = groupNamed(
      getConditionValueOptions(mixed, t, undefined, true),
      "common.auto_captured"
    )?.options.map((option) => option.value);

    expect(labels).not.toContain("country");
    expect(labels).not.toContain("finished");
  });

  test("a field the survey declares itself shadows the catalog entry of the same name", () => {
    // Two rows spelled `url` would be indistinguishable, and the survey's own declaration is the one
    // that holds a value — so the reserved entry steps aside rather than both being offered.
    const shadowing = survey([field({ storageKey: "url", name: "url" })]);
    const groups = getConditionValueOptions(shadowing, t, undefined, true);

    expect(groupNamed(groups, "common.embedded_data")?.options.map((option) => option.value)).toEqual([
      "url",
    ]);
    expect(groupNamed(groups, "common.auto_captured")?.options.map((option) => option.value)).not.toContain(
      "url"
    );
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

  test("a computed date field (ENG-6935) gets chronological comparison and a date input", () => {
    const withComputedDate = survey([
      field({ storageKey: "signed_up_at", source: "computed", dataType: "date" }),
    ]);
    const variableCondition = condition({ type: "variable", value: "signed_up_at" });

    expect(operatorValues(getConditionOperatorOptions(variableCondition, withComputedDate, t))).toEqual(
      expect.arrayContaining(["isBefore", "isAfter"])
    );
    expect(getMatchValueProps(variableCondition, withComputedDate, t).inputType).toBe("date");
  });

  test("a condition pointing at a deleted field falls back to the widest safe set", () => {
    // A condition outlives the field it points at, and an operand with no operators at all would
    // strand the author in a row they can neither complete nor understand.
    expect(operatorsFor("deleted_field")).toContain("contains");
  });

  test("a condition pointing at a catalog entry that no longer exists falls back the same way", () => {
    // The reserved twin of the case above. Both arms carry the same reasoning and only one was
    // pinned, so flipping this fallback to `number` passed the whole suite.
    expect(
      operatorValues(
        getConditionOperatorOptions(condition({ type: "reserved", value: "retiredEntry" }), typed, t)
      )
    ).toContain("contains");
  });

  test("a computed operand resolves through the computed rows, not through any row sharing its key", () => {
    // The two halves of one operand have to agree about which row it names. This side reads
    // `getComputedFieldOptions`; `getMatchValueProps` reads `getOperandDataType`, which is filtered
    // by the operand type's source for exactly this reason. Unfiltered, an ingested row with the same
    // storage key would answer, and the row would offer text operators beside a number input.
    const clash = survey([
      field({ storageKey: "dup", dataType: "number" }),
      field({ storageKey: "dup", source: "computed", dataType: "string" }),
    ]);
    const operators = operatorValues(
      getConditionOperatorOptions(condition({ type: "variable", value: "dup" }), clash, t)
    );
    const props = getMatchValueProps(condition({ type: "variable", value: "dup" }), clash, t);

    expect(operators).toContain("contains");
    expect(props.inputType).toBe("text");
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
    expect(groupNamed(props.options, "common.choices")?.options).toEqual([
      { label: "common.true", value: "true", meta: { type: "static" } },
      { label: "common.false", value: "false", meta: { type: "static" } },
    ]);
  });

  test("a boolean field can still be compared to another field, not only to a literal", () => {
    // Dropping the free-text box is the fix; dropping the reference groups with it would not be.
    // With `showInput: false` a stored field-to-field condition has nowhere to render: the combobox
    // matches the stored value against the options, finds none, and draws an empty trigger — after
    // which picking True silently replaces the reference.
    const embedded = groupNamed(propsFor("is_trial").options, "common.embedded_data");

    expect(embedded?.options.map((option) => option.value)).toEqual(["plan"]);
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

  test("only a computed date field gets the date Set value row", () => {
    // P38: a date field's Set value is stored as an expression, its one-step row included.
    const withDate = survey([
      field({ storageKey: "signup", name: "Signup", dataType: "date" }),
      field({ storageKey: "checked", name: "Checked", source: "computed", dataType: "date" }),
      field({ storageKey: "score", name: "Score", source: "computed", dataType: "number" }),
    ]);

    expect(isComputedDateField(withDate, "checked")).toBe(true);
    expect(isComputedDateField(withDate, "score")).toBe(false);
    expect(isComputedDateField(withDate, "signup")).toBe(false);
    expect(isComputedDateField(withDate, "")).toBe(false);
  });

  test("a date field is set to a day, a date question's answer or another date field, one step only assigning", () => {
    const lastBlockIdx = surveyFlowFixture.blocks.length - 1;
    const groups = getActionValueOptions(
      SURVEY_FLOW_FIXTURE_IDS.variables.signedUpAt,
      surveyFlowFixture,
      lastBlockIdx,
      t
    );

    expect(groupNamed(groups, "common.questions")?.options.map((option) => option.value)).toEqual([
      "last_purchase",
    ]);
    expect(groupNamed(groups, "common.embedded_data")?.options.map((option) => option.value)).toEqual([
      SURVEY_FLOW_FIXTURE_IDS.hiddenFields.signupDate,
    ]);
    expect(getActionOperatorOptions(t, "date").map((option) => option.value)).toEqual(["assign"]);
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

    const expectedInput: Record<TEmbeddedDataType, string | undefined> = {
      string: "text",
      number: "number",
      date: "date",
      // The one type with no free-text box at all: its two spellings are offered as choices.
      boolean: undefined,
    };

    for (const dataType of dataTypes) {
      const localSurvey = survey([field({ storageKey: "f", dataType })]);
      const props = getMatchValueProps(condition({ type: "hiddenField", value: "f" }), localSurvey, t);

      expect(props.show).toBe(true);
      expect(props.showInput).toBe(dataType !== "boolean");
      expect(props.inputType).toBe(expectedInput[dataType]);
    }
  });
});

/**
 * The right-hand side when the operand is a survey **element**, which `getElementMatchValueProps`
 * answers with a six-way dispatch on the element's type.
 *
 * Its own fixture rather than the shared one: the scales and the choice list would change what the
 * questions group holds for every other test here. Before these cases the whole switch was
 * unreachable from a unit test — `getMatchValueProps` was only ever called with a `hiddenField` or
 * `reserved` operand — so four mutations inside it passed the entire suite.
 */
describe("getMatchValueProps for an element operand", () => {
  const withElements = (): TSurvey =>
    ({
      id: "survey1",
      endings: [],
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "q_rating",
              type: TSurveyElementTypeEnum.Rating,
              headline: { default: "How was it?" },
              required: false,
              scale: "number",
              range: 5,
            },
            {
              id: "q_nps",
              type: TSurveyElementTypeEnum.NPS,
              headline: { default: "Would you recommend us?" },
              required: false,
            },
            {
              id: "q_choice",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Pick one" },
              required: false,
              choices: [
                { id: "c1", label: { default: "Alpha" } },
                { id: "c2", label: { default: "Beta" } },
              ],
              shuffleOption: "none",
            },
            {
              id: "q_when",
              type: TSurveyElementTypeEnum.Date,
              headline: { default: "When?" },
              required: false,
              format: "M-d-y",
            },
          ],
        },
      ],
      embeddedFields: [
        field({ storageKey: "plan", name: "Plan" }),
        field({ storageKey: "score", name: "Score", source: "computed", dataType: "number" }),
        field({ storageKey: "note", name: "Note", source: "computed", dataType: "string" }),
        field({ storageKey: "signed_up", name: "Signed up", dataType: "date" }),
      ],
    }) as unknown as TSurvey;

  const propsForElement = (elementId: string, operator: TSingleCondition["operator"] = "equals") =>
    getMatchValueProps(condition({ type: "element", value: elementId }, operator), withElements(), t);

  test("NPS offers its whole 0-10 scale, and a rating its declared range", () => {
    // Off by one at either end is a value the author cannot select and a respondent can answer with.
    expect(propsForElement("q_nps").options[0].options.map((option) => option.value)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(propsForElement("q_rating").options[0].options.map((option) => option.value)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  test("a numeric scale compares against computed fields only", () => {
    // The one branch that filters by source: an ingested field's value arrives as text from outside
    // the survey, and a scale answer is a number the respondent picked.
    const embedded = groupNamed(propsForElement("q_rating").options, "common.embedded_data");

    expect(embedded?.options.map((option) => option.value)).toEqual(["score"]);
  });

  test("a date question keeps every text field the old Date branch offered", () => {
    // The carve-out in `isEmbeddedFieldComparableAs`, and the half of that rule nothing pinned:
    // opposite a `date`, a **computed** string is offered too — today's Date branch does that, and
    // a text field's value is free text a respondent may well have typed a date into. Ingested
    // strings come along by the general rule; the computed `note` is here only because of the
    // `wanted === "date"` arm. `score` is a number and cannot be read as a day, so it is out.
    const embedded = groupNamed(propsForElement("q_when").options, "common.embedded_data");

    expect(embedded?.options.map((option) => option.value)).toEqual(["plan", "note", "signed_up"]);
  });

  test("a choice question offers its own choices as static values", () => {
    // `meta.type` is what `ConditionsEditor` copies onto the stored right operand, so a choice
    // labelled as a reference would be looked up as a field id and resolve to nothing.
    expect(groupNamed(propsForElement("q_choice").options, "common.choices")?.options).toEqual([
      { label: "Alpha", value: "c1", meta: { type: "static" } },
      { label: "Beta", value: "c2", meta: { type: "static" } },
    ]);
  });
});

describe("operators that take no right-hand side", () => {
  const typed = survey([field({ storageKey: "plan", name: "Plan" })]);

  // Twelve operators share this rule and only `isSet` was pinned, so dropping any of the other
  // eleven left the editor drawing a value input for an operator the evaluator ignores.
  test.each([
    "isSet",
    "isNotSet",
    "isSkipped",
    "isSubmitted",
    "isAccepted",
    "isBooked",
    "isClicked",
    "isPartiallySubmitted",
  ] as const)("%s asks for nothing", (operator) => {
    expect(getMatchValueProps(condition({ type: "hiddenField", value: "plan" }, operator), typed, t)).toEqual(
      { show: false, options: [] }
    );
  });
});

describe("a rule before the first question counts as a use, so deleting what it names warns", () => {
  const ids = SURVEY_FLOW_FIXTURE_IDS;
  /** The fixture with only its rules before the first question: no block rule or fallback is a use. */
  const startRulesOnly = (): TSurvey => {
    const survey = structuredClone(surveyFlowFixture);
    survey.blocks = survey.blocks.map(({ logicFallback: _fallback, ...block }) => ({ ...block, logic: [] }));
    return survey;
  };
  const withoutStartRules = (): TSurvey => ({ ...startRulesOnly(), startLogic: null });

  test("an ending a start rule screens out to", () => {
    expect(findEndingCardUsedInLogic(startRulesOnly(), ids.endings.notForYou)).toBe(START_LOGIC_USE_INDEX);
    expect(findEndingCardUsedInLogic(withoutStartRules(), ids.endings.notForYou)).toBe(-1);
  });

  test("a block a start rule jumps to", () => {
    expect(findBlockUsedInLogic(startRulesOnly(), ids.blocks.heavyUsers)).toBe(START_LOGIC_USE_INDEX);
  });

  test("an Embedded Data field a start rule reads or sets", () => {
    expect(findHiddenFieldUse(startRulesOnly(), ids.hiddenFields.panelId)).toEqual({
      kind: "startLogic",
      elementIndex: START_LOGIC_USE_INDEX,
    });
    expect(findVariableUse(startRulesOnly(), ids.variables.segment)?.kind).toBe("startLogic");
    expect(findVariableUse(withoutStartRules(), ids.variables.segment)?.kind).not.toBe("startLogic");
  });
});

describe("a reference inside a Set value expression counts as used in logic (ENG-6935)", () => {
  // `signup_date` and `signed_up_at` appear in the fixture only inside the tenure step's formula.
  test("an ingested and a computed field read by a formula", () => {
    expect(
      findHiddenFieldUsedInLogic(surveyFlowFixture, SURVEY_FLOW_FIXTURE_IDS.hiddenFields.signupDate)
    ).not.toBe(-1);
    expect(findVariableUsedInLogic(surveyFlowFixture, SURVEY_FLOW_FIXTURE_IDS.variables.signedUpAt)).not.toBe(
      -1
    );
  });

  test("a question read by a formula", () => {
    // Only the score step left, so nothing else (a jump into csat's block) can count as a use.
    const survey = structuredClone(surveyFlowFixture);
    survey.blocks = survey.blocks.map((block) => ({
      ...block,
      logic: (block.logic ?? []).filter((rule) => rule.id === SURVEY_FLOW_FIXTURE_IDS.setValue.scoreRule),
    }));
    expect(findElementUsedInLogic(survey, "csat")).toBe(-1);

    const scoreStep = survey.blocks[1].logic![0];
    scoreStep.actions[0] = {
      ...scoreStep.actions[0],
      value: {
        type: "expression",
        value: { type: "call", fn: "abs", args: [{ type: "element", value: "csat" }] },
      },
    } as (typeof scoreStep.actions)[number];

    expect(findElementUsedInLogic(survey, "csat")).not.toBe(-1);
  });
});

describe("removal guards also see show-if (ENG-6931)", () => {
  // Without block logic, the fixture's only uses of "services" and its "prime" option are the show-if
  // of the Heavy users block (block 2, question "hours").
  const withoutLogic = (): TSurvey => {
    const survey = structuredClone(surveyFlowFixture);
    survey.blocks = survey.blocks.map((block) => ({ ...block, logic: [], logicFallback: undefined }));
    return survey;
  };
  const flatIndexOf = (survey: TSurvey, elementId: string) =>
    survey.blocks.flatMap((block) => block.elements).findIndex((element) => element.id === elementId);

  test("a question a block's show-if depends on is reported as used", () => {
    const survey = withoutLogic();
    // "recommend" copies "services", which a removal guard names first (ENG-6938); unlinked here.
    delete (survey.blocks[5].elements[12] as { optionsCopiedFrom?: string }).optionsCopiedFrom;

    expect(findElementUsedInLogic(survey, "services")).toBe(flatIndexOf(survey, "hours"));
  });

  test("a question another question's show-if depends on is reported as used", () => {
    const survey = withoutLogic();

    // "apple_reason" is shown only if "fav" is Apple TV+.
    expect(findElementUsedInLogic(survey, "fav")).toBe(flatIndexOf(survey, "apple_reason"));
  });

  test("an option a show-if compares against is reported as used", () => {
    const survey = withoutLogic();

    expect(findOptionUsedInLogic(survey, "services", "prime")).toBe(flatIndexOf(survey, "hours"));
    // ENG-6937: "Apple TV+" in "fav" is offered only if "services" includes Apple TV+.
    expect(findOptionUsedInLogic(survey, "services", "apple")).toBe(flatIndexOf(survey, "fav"));
  });

  test("says which kind of use stops a removal, so the guard can word it (show-if, not logic)", () => {
    const survey = withoutLogic();

    expect(findElementUse(survey, "fav")).toEqual({
      kind: "showIf",
      elementIndex: flatIndexOf(survey, "apple_reason"),
    });
    expect(findOptionUse(survey, "services", "apple")).toEqual({
      kind: "showIf",
      elementIndex: flatIndexOf(survey, "fav"),
    });
    // With the fixture's logic back, a rule is what the guard names first.
    expect(findElementUse(surveyFlowFixture, "bundle")?.kind).toBe("logic");
  });

  test("a question an option's show-if depends on is reported as used (ENG-6937)", () => {
    const survey = withoutLogic();

    // Poster B in "ad_pick" is offered only once "brand_rank" is answered.
    expect(findElementUsedInLogic(survey, "brand_rank")).toBe(flatIndexOf(survey, "ad_pick"));
  });

  test("a hidden field a show-if reads is reported as used", () => {
    const survey = withoutLogic();
    const signupDate = SURVEY_FLOW_FIXTURE_IDS.hiddenFields.signupDate;
    expect(findHiddenFieldUsedInLogic(survey, signupDate)).toBe(-1);

    survey.blocks[4].elements[3].showIf = {
      id: "showifgroup0000000000010",
      connector: "and",
      conditions: [
        {
          id: "showifcond00000000000010",
          leftOperand: { type: "hiddenField", value: signupDate },
          operator: "isSet",
        },
      ],
    };

    expect(findHiddenFieldUsedInLogic(survey, signupDate)).toBe(flatIndexOf(survey, "email"));
  });

  test("a question whose options another question copies is reported as used (ENG-6938)", () => {
    const survey = withoutLogic();
    // Only the link left: no show-if anywhere reads "brand_rank".
    const adPick = survey.blocks[5].elements[4] as unknown as { choices: { showIf?: unknown }[] };
    adPick.choices.forEach((choice) => delete choice.showIf);
    expect(findElementUsedInLogic(survey, "brand_rank")).toBe(-1);

    const recommend = survey.blocks[5].elements[12] as unknown as Record<string, unknown>;
    recommend.optionsCopiedFrom = "brand_rank";

    expect(findElementUsedInLogic(survey, "brand_rank")).toBe(flatIndexOf(survey, "recommend"));
  });

  test("a real copy reports its source as copied, not as a show-if, though its options' show-ifs read it", () => {
    const survey = withoutLogic();
    // Every show-if of the survey's own goes; the ones a copy writes on its options stay: "recommend"
    // copies "services", each option shown only if it was picked there.
    survey.blocks.forEach((block) => {
      delete block.showIf;
      block.elements.forEach((element) => {
        delete element.showIf;
        if (element.id === "recommend") return;
        const choices = (element as { choices?: { showIf?: unknown }[] }).choices ?? [];
        choices.forEach((choice) => delete choice.showIf);
      });
    });
    const recommend = survey.blocks[5].elements[12] as unknown as { choices: { showIf?: unknown }[] };
    expect(recommend.choices.filter((choice) => choice.showIf)).toHaveLength(4);

    expect(findElementUse(survey, "services")).toEqual({
      kind: "copiedOptions",
      elementIndex: flatIndexOf(survey, "recommend"),
    });
  });
});

describe("getActionObjectiveOptions", () => {
  test("the action that writes a field is called Set value, as in the glossary and Add logic", () => {
    expect(getActionObjectiveOptions(t).find((option) => option.value === "calculate")?.label).toBe(
      "workspace.surveys.edit.flow.set_value"
    );
  });

  test("lists the rule types in Add logic's order, each with its own icon", () => {
    const options = getActionObjectiveOptions(t);

    expect(options.map((option) => [option.value, option.label])).toEqual([
      ["jumpToBlock", "workspace.surveys.edit.flow.jump_to"],
      ["calculate", "workspace.surveys.edit.flow.set_value"],
      ["requireAnswer", "workspace.surveys.edit.require_answer"],
      ["markLowQuality", "workspace.surveys.edit.mark_as_low_quality"],
    ]);
    expect(new Set(options.map((option) => option.icon)).size).toBe(4);
    expect(options.every((option) => option.icon)).toBe(true);
  });
});

describe("ranking conditions in the editor (T21, ENG-6937)", () => {
  const rankedCondition: TSingleCondition = {
    id: "rankedcondition000000001",
    leftOperand: { type: "element", value: "brand_rank" },
    operator: "includesOneOf",
    rightOperand: { type: "static", value: [] },
  };

  test("a ranking offers 'includes one of' and its options, by id", () => {
    const operators = getConditionOperatorOptions(rankedCondition, surveyFlowFixture, t).map(
      (option) => option.value
    );
    expect(operators).toEqual(expect.arrayContaining(["includesOneOf", "includesAllOf"]));

    const props = getMatchValueProps(rankedCondition, surveyFlowFixture, t);
    const values = (props.options as TComboboxGroupedOption[]).flatMap((group) =>
      group.options.map((option) => option.value)
    );
    expect(values).toEqual(["netflix", "disney", "prime"]);
  });
});

/**
 * ENG-6934: the editor shows a matrix condition's row and column the way the engines read them, by id,
 * so a row or column reordered in this session does not show the condition on another cell until the
 * save rewrites the positions.
 */
describe("matrix conditions by id in the editor", () => {
  const PROFILE = 5;
  const reordered = (): TSurvey => {
    const survey = structuredClone(surveyFlowFixture);
    const grid = survey.blocks
      .flatMap((block) => block.elements)
      .find((element) => element.id === "brand_grid") as { rows: unknown[]; columns: unknown[] };
    grid.rows.reverse();
    grid.columns.reverse();
    return survey;
  };
  const matrixCondition = (survey: TSurvey): TSingleCondition =>
    survey.blocks[PROFILE].logic![0].conditions.conditions[0] as TSingleCondition;

  test("the row picker shows the row the id names, after a reorder", () => {
    const survey = reordered();

    // Netflix (row_netflix) was row 0 and is now row 1.
    expect(getFormatLeftOperandValue(matrixCondition(survey), survey)).toBe("brand_grid.1");
  });

  test("the column picker shows the column the id names, after a reorder", () => {
    const survey = reordered();

    // Good (col_good) was column 1 and is now column 0.
    expect(getFormatRightOperandValue(matrixCondition(survey), survey)).toBe("0");
  });

  test("other conditions show their stored value", () => {
    const survey = structuredClone(surveyFlowFixture);
    const dateCondition = survey.blocks[PROFILE].logic![0].conditions.conditions[1] as TSingleCondition;

    expect(getFormatRightOperandValue(dateCondition, survey)).toBe("2026-01-01");
  });

  test("a row condition written in the id form alone gets the row operators", () => {
    const survey = structuredClone(surveyFlowFixture);
    const condition = matrixCondition(survey);
    if (condition.leftOperand.type === "element") condition.leftOperand.meta = { rowId: "row_disney" };

    const operators = getConditionOperatorOptions(condition, survey, t).map((option) => option.value);
    expect(operators).toContain("isAnyOf");
  });
});

/**
 * jobenjada review #27: a matrix in the condition picker says it is a Matrix, so its code isn't read
 * as its type, and its whole-question choice reads "Any row (…)" next to rows that read "Editor (…)".
 */
describe("a matrix in the condition picker", () => {
  const matrixOption = () =>
    getConditionValueOptions(surveyFlowFixture, t)
      .flatMap((group) => group.options)
      .find((option) => option.value === "brand_grid");

  test("carries a Matrix hint", () => {
    expect(matrixOption()?.meta?.badge).toBe("workspace.surveys.edit.matrix_badge");
  });

  test("offers its rows, then any row, each naming the question", () => {
    const [rows, anyRow] = matrixOption()?.children ?? [];
    const question = matrixOption()?.label;

    expect(rows.children?.map((row) => [row.value, row.label])).toEqual([
      ["brand_grid.0", `Netflix (${question})`],
      ["brand_grid.1", `Disney+ (${question})`],
    ]);
    expect([anyRow.value, anyRow.label]).toEqual([
      "brand_grid",
      `workspace.surveys.edit.matrix_all_fields (${question})`,
    ]);
  });
});
