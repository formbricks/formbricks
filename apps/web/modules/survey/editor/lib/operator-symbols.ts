/**
 * The symbols the Flow tab writes for operators, so a rule's summary and its pickers say the same
 * thing: `score × 2` in the row, a "×" pill beside "Multiply" in the Set value picker.
 */

/** A one-step Set value's operator, as the rule row and the operator picker write it. */
export const CALCULATE_SYMBOLS: Readonly<Record<string, string>> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  assign: "=",
  concat: "+",
};
