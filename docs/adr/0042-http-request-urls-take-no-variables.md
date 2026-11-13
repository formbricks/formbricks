# An HTTP request's URL takes no Variables

A workflow's HTTP request step has a fixed URL. Variables can fill query parameter values (name and value rows, URL-encoded), header values and the JSON body, but never the URL itself, and saving refuses a URL that contains one (ENG-7168). A Webhook trigger accepts any payload from anyone holding its Secret URL (ADR 0041), so a Variable in the URL would let that payload choose the host, and the request would carry the step's secret headers and data to it. Keeping the URL fixed means a payload can change what is sent, never where it goes.

## Considered Options

- **Variables anywhere after the host**: allows dynamic paths (`/customers/@customer.id`), but splitting the URL into a fixed and a templated part is easy to get wrong, and a crafted value can still traverse the path. Query parameters cover the same lookups.
- **Bind secret header values to the host they were entered for**: protects the secrets but not the payload data, and adds a confusing "your secret was cleared" state whenever someone edits the URL.

## Consequences

- An API whose resource id lives in the path (`/customers/123`) can't be called with a per-run id in Part 2; the author needs an endpoint that takes it as a query parameter or in the body. Allowing path Variables later means revisiting this ADR.
- Changing the URL stays a write-access edit, recorded in the audit log, and every Test request is audited with its host.
