# Set value is a calculate action, and a rule with no conditions always runs

The Flow tab's "Set a value" steps and calculations write a computed Embedded Data field with the existing `calculate` action, using `operator: "assign"` and a new value type `{ type: "expression", … }` (ADR 0024). An unconditional step is an ordinary rule whose condition group is an empty `and` group, which both logic engines already evaluate as true. A minor release can only add to the public survey JSON, so the existing action and the required `conditions` field stay as they are.

## Considered Options

- **A new `setValue` action**: a clearer name, but two actions would do one job forever, in both engines, the validator, the Flow tab and the AI docs.
- **Optional `conditions`**: tidier JSON, but API readers that expect every rule to carry `conditions` break on new surveys.

## Consequences

- Old one-step calculations (`add 1`) keep working and keep their "empty counts as 0" behaviour; the Flow tab shows them as `score + 1`.
- A reader has to treat an empty `and` group as "always", never as "no rule".
