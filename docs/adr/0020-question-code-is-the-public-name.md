# The question code, not the element id, is a question's public name

Element ids stay generated and become read-only in the editor; the question code (the editor's "Variable name", ENG-3596) becomes the readable name wherever users used to see the id (ENG-3885, decided 2026-10-12). Webhook payloads carry the question code next to the id, prefill and start-at links accept `?<questionCode>=` and `?startAt=<questionCode>` alongside the id, and the docs that told users to rename ids move to the question code. Existing surveys keep their custom ids, because responses are stored under them, and the API and MCP still accept custom ids on create, so no client breaks.

## Considered Options

- **Keep editable ids**: two readable names per question that users must keep apart, and id validation errors and embedded-data key collisions stay.
- **Read-only ids and nothing else**: the smallest change, but every new Zapier or prefill setup would key on ids like `clx9k2pq0001`.

## Consequences

- Old and new surveys stay mixed for good: integrations must accept either key.
- Built-in Google Sheets, Airtable, Notion and Slack integrations keep keying on the id internally.
