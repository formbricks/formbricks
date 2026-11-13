# Workflow Variables are prefixed paths carried in recall tokens

A workflow names every value a run can use with one dot path whose first segment says where it comes from: `payload.<path>`, `steps.<stepId>.<path>` or `response.<questionId>` (ENG-7165). Conditions store the path in their data reference; text fields store it in the existing recall token, `#recall:<path>/fallback:<text>#`, so the email editor, the recall picker and the expansion code are extended rather than forked. A token that holds only a question id keeps meaning a survey answer, so workflows saved before Part 2 keep working. Steps are named by id, so renaming a step never breaks a reference, and agents writing workflows through API v3 and MCP use the same strings the editor saves.

## Considered Options

- **A second template syntax (`{{payload.customer.email}}`)**: easier to read, but every text field would carry two syntaxes forever.
- **Structured references (`{source, stepId, pointer}`)**: exact, including keys that contain dots, but heavy for agents to write and awkward inside text.

## Consequences

- Only the three prefixes are accepted; saving refuses any other, so new namespaces (`run.`, `item.`) can be added later without meeting saved data that already uses them.
- Path segments `__proto__`, `prototype` and `constructor` are refused everywhere.
- A path can't go into or end at a list in a payload or an HTTP response until loops exist (ENG-7173); survey answers that are lists keep what recall already does with them.
- Keys that contain a dot can't be reached.
- How a value is inserted depends on where: URL-encoded in query parameters, line breaks stripped in headers, typed when a token is a whole JSON value and escaped inside a JSON string. The HTTP request URL takes none (ADR 0042).
