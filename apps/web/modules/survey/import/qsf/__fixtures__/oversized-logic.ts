/**
 * A survey at the reader's limits with every logic rule as large as the reader keeps it: 200
 * questions, each on its own page behind a branch, each with display logic of 20 groups of 20
 * conditions comparing long values, plus 20 skip rules. Built in code: as a file it is ~20 MB.
 */
export function buildOversizedLogicQsf(questionCount = 200): Record<string, unknown> {
  const longValue = "v".repeat(200);
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
      Array.from({ length: 20 }, (_, group) => [
        String(group),
        {
          Type: "If",
          ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i), condition(target, i)])),
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
        SkipLogic: Array.from({ length: 20 }, () => ({
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
    flow.push({
      Type: "Branch",
      BranchLogic: booleanExpression(target),
      Flow: [{ Type: "Block", ID: `BL_${n}` }],
    });
  }
  elements.push({ Element: "BL", Payload: blocks }, { Element: "FL", Payload: { Flow: flow } });

  return { SurveyEntry: { SurveyName: "Oversized logic", SurveyLanguage: "EN" }, SurveyElements: elements };
}
