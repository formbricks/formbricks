const SCALE = [
  "Strongly disagree",
  "Disagree",
  "Somewhat disagree",
  "Neutral",
  "Somewhat agree",
  "Agree",
  "Strongly agree",
];

/**
 * A large but ordinary survey: 200 Likert matrices of 8 statements on a 7-point scale, each on its
 * own page behind a branch with one two-condition rule, and a display rule of two conditions on the
 * question. About 480 KB as a file. Its tightest full prompt is over the budget, so the import has
 * to describe it more coarsely rather than refuse it.
 */
export function buildMatrixHeavyQsf(questionCount = 200): Record<string, unknown> {
  const twoConditions = (target: number) => ({
    Type: "BooleanExpression",
    "0": {
      Type: "If",
      "0": {
        LogicType: "Question",
        LeftOperand: `q://QID${target}/SelectableAnswer/1/6`,
        Operator: "Selected",
        Type: "Expression",
      },
      "1": {
        LogicType: "Question",
        LeftOperand: `q://QID${target}/SelectableAnswer/2/7`,
        Operator: "Selected",
        Conjuction: "Or",
        Type: "Expression",
      },
    },
  });

  const elements: unknown[] = [];
  const blocks: unknown[] = [];
  const flow: unknown[] = [];
  for (let n = 1; n <= questionCount; n++) {
    const target = Math.max(1, n - 1);
    elements.push({
      Element: "SQ",
      PrimaryAttribute: `QID${n}`,
      Payload: {
        QuestionText: `Please rate how much you agree with each statement about part ${n} of our service.`,
        DataExportTag: `Q${n}`,
        QuestionType: "Matrix",
        Selector: "Likert",
        SubSelector: "SingleAnswer",
        Choices: Object.fromEntries(
          Array.from({ length: 8 }, (_, i) => [
            String(i + 1),
            { Display: `Statement ${i + 1} about part ${n} of the service` },
          ])
        ),
        ChoiceOrder: Array.from({ length: 8 }, (_, i) => String(i + 1)),
        Answers: Object.fromEntries(SCALE.map((label, i) => [String(i + 1), { Display: label }])),
        AnswerOrder: SCALE.map((_, i) => String(i + 1)),
        ...(n > 1 ? { DisplayLogic: twoConditions(target) } : {}),
      },
    });
    blocks.push({
      ID: `BL_${n}`,
      Type: "Standard",
      Description: `Part ${n}`,
      BlockElements: [{ Type: "Question", QuestionID: `QID${n}` }],
    });
    flow.push(
      n > 1
        ? { Type: "Branch", BranchLogic: twoConditions(target), Flow: [{ Type: "Block", ID: `BL_${n}` }] }
        : { Type: "Block", ID: `BL_${n}` }
    );
  }
  elements.push({ Element: "BL", Payload: blocks }, { Element: "FL", Payload: { Flow: flow } });

  return { SurveyEntry: { SurveyName: "Service ratings", SurveyLanguage: "EN" }, SurveyElements: elements };
}
