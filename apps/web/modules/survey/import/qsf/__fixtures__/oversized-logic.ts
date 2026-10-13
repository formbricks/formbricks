interface TLogicShape {
  questions: number;
  /** Condition groups, and conditions per group, of each display and branch rule. */
  groups: number;
  conditions: number;
  /** Skip rules per question, on top of its display rule. */
  skipRules: number;
  /** Each question on its own page behind a branch. */
  branches: boolean;
  valueLength: number;
}

/** The worst the reader admits: 21 rules a question, 400 conditions a rule, a branch per page. */
const OVERSIZED: TLogicShape = {
  questions: 200,
  groups: 20,
  conditions: 20,
  skipRules: 20,
  branches: true,
  valueLength: 200,
};

/**
 * A survey at the reader's question limit with logic of a given shape. By default every logic rule is
 * as large as the reader keeps it: 200 questions, each on its own page behind a branch, each with
 * display logic of 20 groups of 20 conditions comparing long values, plus 20 skip rules — about 67 MB
 * in memory, so it is built in code rather than committed.
 */
export function buildOversizedLogicQsf(shape: Partial<TLogicShape> = {}): Record<string, unknown> {
  const {
    questions: questionCount,
    groups,
    conditions,
    skipRules,
    branches,
    valueLength,
  } = {
    ...OVERSIZED,
    ...shape,
  };
  const longValue = "v".repeat(valueLength);
  const condition = (target: number, index: number) => ({
    LogicType: index % 2 === 0 ? "Question" : "EmbeddedField",
    LeftOperand: index % 2 === 0 ? `q://QID${target}/SelectableChoice/1` : `field_${"f".repeat(150)}`,
    Operator: "EqualTo",
    RightOperand: longValue,
    Conjuction: "Or",
    Type: "Expression",
  });
  const booleanExpression = (target: number) => ({
    Type: "BooleanExpression",
    ...Object.fromEntries(
      Array.from({ length: groups }, (_, group) => [
        String(group),
        {
          Type: "If",
          ...Object.fromEntries(
            Array.from({ length: conditions }, (_, i) => [String(i), condition(target, i)])
          ),
        },
      ])
    ),
  });

  const elements: unknown[] = [];
  const blocks: unknown[] = [];
  const flow: unknown[] = [];
  for (let n = 1; n <= questionCount; n++) {
    const target = n === 1 ? 1 : n - 1;
    elements.push({
      Element: "SQ",
      PrimaryAttribute: `QID${n}`,
      Payload: {
        QuestionText: `Question ${n} ${"t".repeat(400)}`,
        DataExportTag: `Q${n}`,
        QuestionType: "MC",
        Selector: "SAVR",
        Choices: { "1": { Display: "Yes" }, "2": { Display: "No" } },
        ChoiceOrder: ["1", "2"],
        DisplayLogic: booleanExpression(target),
        SkipLogic: Array.from({ length: skipRules }, () => ({
          ChoiceLocator: `q://QID${n}/SelectableChoice/2`,
          Condition: "Selected",
          SkipToDestination: "ENDOFSURVEY",
        })),
      },
    });
    blocks.push({
      ID: `BL_${n}`,
      Type: "Standard",
      BlockElements: [{ Type: "Question", QuestionID: `QID${n}` }],
    });
    flow.push(
      branches
        ? { Type: "Branch", BranchLogic: booleanExpression(target), Flow: [{ Type: "Block", ID: `BL_${n}` }] }
        : { Type: "Block", ID: `BL_${n}` }
    );
  }
  elements.push({ Element: "BL", Payload: blocks }, { Element: "FL", Payload: { Flow: flow } });

  return { SurveyEntry: { SurveyName: "Oversized logic", SurveyLanguage: "EN" }, SurveyElements: elements };
}
