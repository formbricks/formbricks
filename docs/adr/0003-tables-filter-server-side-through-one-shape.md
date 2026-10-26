# Every table filters on the server through one filter shape

Every list table on the shared table toolbar (Feedback Records, Surveys, Contacts, Attributes, Workflows, Segments, Responses and the Summary that shares its filter) filters, sorts, searches and counts on the server, and all of them describe active filters with one shape: a list of `{ property, operator, values }`, combined with AND. That shape is written to the page URL in the `/api/v3` query syntax (`filter[<property>][<operator>]=a,b`), so the URL a user shares is the query the table sends, and one codec, one chip renderer and one Advanced filter serve every table. Each table only declares its filter properties and translates the shape for its backend (Prisma, or the Hub for Feedback Records). This holds even for tables small enough to load whole, such as Attributes and Segments, because the match count and every filter should mean the same thing on every table, and a client-side path would be a second implementation to keep in step.

## Considered Options

- **Filter small, fully loaded tables in the browser**: rejected; it splits behaviour by table size and needs a second filter engine.
- **Keep filter state in browser storage or React state**: rejected; filters that silently stick across visits make a filtered list look like the full one, and state that a reload loses cannot be shared.
- **A compact custom URL encoding**: rejected; it needs a second parser and a translation step to every API.

## The one exception: relative dates

A date preset is kept by name in the URL (`filter[createdAt][preset]=last7Days`) and a custom range as calendar dates, so a shared link stays relative to the day it is opened. Just before the request they are resolved to ISO `gte`/`lte` bounds in the organization's reporting time zone. The public API only ever receives absolute dates.

## Consequences

- Attributes and Segments gain `/api/v3` list endpoints with filters, sort, paging and a total count, and Contacts gets a new one.
- Whatever a table can filter by has to be expressible as a v3 query parameter, so new filter properties are public API changes held to v3's compatibility rules.
- Surveys and Workflows stop remembering filters between visits; sort and column choices stay in browser storage.
- Responses moves onto `/api/v3/responses`, whose filters now run through the same where-builder as Summary and downloads. Its match count stops at 10,000 and reads "10,000+" beyond that.
- Quick-filter value lists come from a bounded per-property endpoint, never from loading every row.
