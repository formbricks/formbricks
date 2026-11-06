# Expressions are stored as trees, never as text

A Set value expression such as `round(q1 + q2 * 2)` is stored in the survey JSON as a tree of nodes, not as a string. App surveys run inside customer sites whose Content Security Policy often forbids `eval` and `new Function` (the `csp-safe` lint rule and `survey-csp.spec.ts` gate the bundle), and a text format would put a parser in every survey bundle. With a tree, the bundle only walks nodes. The editor parses what people type in the formula box into the tree, and AI writes the tree directly through v3 and MCP, where zod checks its shape. Every operation, arithmetic included, is one node kind, `{ type: "call", fn, args }`, with `fn` from a fixed list (add, subtract, multiply, divide, round, min, max, abs, ifEmpty, concat, now, daysBetween). Leaves reuse the condition operands (`element`, `variable`, `hiddenField`, `reserved`, `static`), and answers are referenced by element id.

## Considered Options

- **Text formulas**: the easiest to read and write by hand, but they need a parser in the bundle, and a renamed reference breaks without a schema error.
- **Separate binary-operator nodes** (`{ type: "binary", op: "+", left, right }`): closer to the written formula, but two node kinds do one job and every reader handles both.
- **A flat token list**: the bundle still needs a precedence parser, and zod cannot check that brackets balance or that a function got the right number of arguments.

## Consequences

- Raw JSON is verbose. The Flow tab and the MCP tool descriptions show the readable formula next to it.
- A new function is a new `fn` value, added to the evaluator, the validator and the editor's parser together.
- Trees are bounded in depth and node count, like every other input.
- Behaviour: an empty input gives an empty result (`ifEmpty` sets a default), dividing by zero gives empty, text in arithmetic is refused at save, and `now()` / `daysBetween()` count UTC calendar days from the respondent's device clock.
