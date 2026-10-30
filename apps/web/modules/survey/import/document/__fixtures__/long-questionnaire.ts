import { docx, p } from "./docx-builders";

/** One question of each kind a questionnaire has, the way Long_Survey_150.docx writes them. */
const QUESTIONS: [type: string, text: string, options: string[]][] = [
  ["Open Text", "What did you think of the event overall?", []],
  ["Single Select", "Which ticket type did you have?", ["Standard", "VIP", "Press"]],
  ["Single Select (dropdown)", "Which colour do you prefer?", ["Red", "Green", "Blue", "Other"]],
  ["Multi Select", "How would you like to be contacted? (select all)", ["Email", "SMS", "Phone", "Post"]],
  ["Rating", "Rate your overall experience.", ["Poor (low) -> Excellent (high)"]],
  ["NPS", "How likely are you to recommend us?", ["0-10 scale"]],
  ["CSAT", "How satisfied are you overall?", ["Very dissatisfied (low) -> Very satisfied (high)"]],
  ["CES", "How easy was it to complete your task?", ["Very difficult (low) -> Very easy (high)"]],
  ["Ranking", "Rank these from most to least important.", ["Price", "Quality", "Speed", "Support"]],
  ["Matrix", "Rate each aspect (Staff, Facilities, Value).", ["Poor", "OK", "Good"]],
  ["Date", "When did you visit?", ["Date picker"]],
  ["Consent", "Do you agree to the terms and conditions?", ["I agree"]],
];

/**
 * A synthetic questionnaire of `count` questions, laid out as Long_Survey_150.docx is: a numbered
 * question, its type, its options as bullets. Past the 200-question AI ceiling at 300, for the eval.
 */
export const longQuestionnaireDocx = (count: number): Uint8Array<ArrayBuffer> => {
  const body = [p(`Long Test Survey (${count} questions)`, { style: "Heading1" })];
  for (let index = 0; index < count; index += 1) {
    const [type, text, options] = QUESTIONS[index % QUESTIONS.length];
    body.push(
      p(`${index + 1}. ${text} (item ${index + 1})`),
      p(`Type: ${type}`),
      ...options.map((option) => p(`  •  ${option}`)),
      p("")
    );
  }
  return docx({ body: body.join("") });
};
