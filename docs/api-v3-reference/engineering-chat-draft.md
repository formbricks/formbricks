`#engineering-chat`

I’ve opened the Scope 1 v3 survey management implementation and RFC artifacts for review:

- OpenAPI: `docs/api-v3-reference/openapi.yml`
- RFC: `docs/api-v3-reference/v3-survey-management-scope-1-rfc.md`

Main decisions:

- single-object survey create/update payloads instead of fragmented endpoints
- strict scope limited to survey structure (`name`, `type`, `status`, `welcomeCard`, `blocks`, `endings`, `hiddenFields`, `variables`)
- strict rejection of unsupported top-level fields
- PATCH uses top-level partial updates with full subtree replacement for provided objects/arrays
- DELETE returns `204 No Content`

Implementation follows the existing v3 conventions:

- session or `x-api-key`
- RFC 9457 problem responses
- `X-Request-Id`
- `private, no-store`
- shared wrapper/auth/error-reporting behavior

Focused tests for the new v3 surface are in place and the targeted coverage for the new `app/api/v3/lib` and `app/api/v3/surveys` surface is above 85%.
