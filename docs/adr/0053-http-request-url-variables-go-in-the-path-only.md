# An HTTP request's URL takes Variables in its path only

This narrows ADR 0058 from "no Variables in the URL" to "no Variables in the origin". An HTTP request step's URL may insert Variables after the first `/` that follows the host and before any `?` or `#`, so `https://api.example.com/customers/@payload.customer.id/orders` works. The scheme, host and port stay plain text: saving (schema, API v3, MCP) refuses a Variable before the path, in the query or fragment, and a `#recall:` token that is not a Variable, and the editor's `@` picker does not open there.

When a step is sent, each inserted value becomes exactly one path segment:

1. **Encoded as one segment.** The value is encoded like a URI component, so `/`, `?`, `#`, `%`, `\` and `@` become `%2F`, `%3F`, `%23`, `%25`, `%5C` and `%40` and can't add a segment, a query, a fragment or user info.
2. **No traversal or empty segments.** A value (or fallback) that is empty, `.` or `..`, also once percent-decoded (`%2e%2e`, `%252e%252e`), fails the step naming the Variable. Nothing falls back to `//` or `/../`.
3. **Origin re-check.** The filled-in URL is parsed again, and the step fails unless its origin equals the origin of the URL's fixed text exactly.
4. **Same limits.** The 2 KB URL limit applies to the filled-in URL (before the query parameter rows are added, which have their own limits), and the SSRF and private-network check, `redirect: "manual"` and host-bound secret headers (ADR 0051, compared against that fixed origin) are unchanged.

Runs, "Don't wait" deliveries, Test runs and Send test request build the call in one place (`buildWorkflowHttpCall`), so the same rules apply to each, and run detail and Test request results show the URL that was sent.

ADR 0058 kept the whole URL fixed because a Webhook payload is attacker-controlled, and a Variable in the URL could choose the host that receives the step's secret headers and data. That risk lives in the origin. The path only chooses a resource on a host the author typed, which the query parameter rows could already do; refusing it blocked every REST API that takes an id in its path (`/customers/123`), the most common shape of an update call.

## Considered Options

- **Keep the URL fixed (ADR 0058)**: no new attack surface, but authors had no way to call `PATCH /customers/{id}`, and the workaround (an endpoint that takes the id as a query parameter) rarely exists.
- **Variables anywhere after the host, inserted as written**: simplest, but a value like `../admin`, `a/b?x=1` or `%2e%2e` would move along the path, add a query, or reach an endpoint the author never meant to call.
- **Whole segments only (a Variable must fill a segment by itself)**: slightly easier to explain, but rules out common shapes like `/files/@id.json` and adds nothing once every value is encoded and `.`/`..`/empty are refused.
- **Strip unsafe characters instead of encoding them**: a changed id silently calls a different resource. Encoding keeps the value intact, and the target answers 404 when it does not exist.

## Consequences

- The definition schema, the executable check (the Variable must be available at this step) and the editor share one parser (`findWorkflowUrlTemplateIssue` in `@formbricks/workflows`); the API spec and MCP tool descriptions say where Variables may go.
- A path value that is missing and has no fallback fails the step rather than calling the collection URL, so a bad payload can't turn an update into a call on the wrong resource. Authors who want a default set a fallback.
- An enabled workflow saved before this change has no URL Variables, so nothing changes for it.
