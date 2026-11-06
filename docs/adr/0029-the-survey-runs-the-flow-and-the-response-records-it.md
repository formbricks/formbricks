# The survey runs the flow, and the response records what it did

Show-if, start logic, Set value expressions and the Mark as low quality action are evaluated only by the survey running on the respondent's device (link, website, app and mobile), with the evaluator shared from `packages/types/surveys/`. The server never replays that logic; it stores what the survey reports. What a respondent was not shown goes into a new nullable JSON column on the response, written while they answer. It lists only what a show-if, a hidden option or a question left with no options kept from them (blocks, elements, options, matrix rows and columns), by ids that are locked once a survey is published (ADR 0020). Results read "not shown" from that record and never by re-running the current rules, so editing a show-if mid-field cannot change past results. A Mark as low quality rule sends a one-way `markLowQuality` flag with the next response update, and the server sets the outcome (ADR 0022); the survey can never clear it or set another value. A screen-out before the first question is created by the survey through today's create endpoint, with a reCAPTCHA token when spam protection is on.

## Considered Options

- **The server replays the rules on each update**: it can't be skipped by tampering, but the server would have to know which pages were shown and run start logic, show-if and expressions, which only the survey's engine does. The two condition engines are near-copies and stay unmerged in this project.
- **Work out "not shown" from the current survey**: no new column, but every later edit to a show-if rewrites the history of past responses.
- **Store it in `meta`, or as a marker in `data`**: `meta` is sent only with the first page, and a marker in `data` reads as an answer to every webhook, integration and API reader.
- **Record everything that was shown**: exact, but large for long surveys, and written even when a survey has no show-if.

## Consequences

- The record and the low-quality flag carry the same trust as the answers: a respondent who tampers with the survey can change all three, but can only ever mark their own response Low quality.
- `null` means unknown (responses from before 6.2 or from an older cached bundle), and results read those as before.
- An answer to an item that ends up hidden is removed from the response, so a response update also removes the `data` keys the record lists, instead of only merging.
- The standard export stays byte-identical. Only the Analysis export uses the record: blank for not shown, 0 for shown but not picked.
