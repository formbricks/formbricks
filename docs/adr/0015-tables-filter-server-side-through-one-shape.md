# Every table filters on the server through one filter shape

Every list table on the shared table toolbar (Feedback Records, Surveys, Contacts, Attributes, Workflows, Segments, Creatives, Responses and the Summary that shares its filter) filters, sorts, searches and counts on the server, and all of them describe active filters with one shape: a list of `{ property, operator, values }`, combined with AND. That shape is written to the page URL in the `/api/v3` query syntax, one key per value (`filter[<property>][<operator>]=a&filter[<property>][<operator>]=b`) because a value may itself hold a comma, so the URL a user shares is the query the table sends, and one codec, one chip renderer and one Advanced filter serve every table. Each table only declares its filter properties and translates the shape for its backend (Prisma, or the Hub for Feedback Records). This holds even for tables small enough to load whole, such as Attributes and Segments, because the match count and every filter should mean the same thing on every table, and a client-side path would be a second implementation to keep in step.

## Considered Options

- **Filter small, fully loaded tables in the browser**: rejected; it splits behaviour by table size and needs a second filter engine.
- **Keep filter state in browser storage or React state**: rejected; filters that silently stick across visits make a filtered list look like the full one, and state that a reload loses cannot be shared.
- **A compact custom URL encoding**: rejected; it needs a second parser and a translation step to every API.

## The one exception: relative dates

A date preset is kept by name in the URL (`filter[createdAt][preset]=last_7_days`) and a custom range as calendar dates, so a shared link stays relative to the day it is opened. Just before the request they are resolved to ISO `gte`/`lte` bounds in the organization's reporting time zone. The public API only ever receives absolute dates.

## Consequences

- Attributes and Segments gain `/api/v3` list endpoints with filters, sort, paging and a total count, and Contacts gets a new one.
- Whatever a table can filter by has to be expressible as a v3 query parameter, so new filter properties are public API changes held to v3's compatibility rules.
- Surveys, Workflows and Creatives stop remembering filters between visits, and their old `formbricks-*-filters` storage keys are removed on the next visit. Sort lives in the URL with the filters (`sortBy`, omitted for the table's default); only column choices stay in browser storage.
- Responses and Summary share the filter through the URL; today their rules are translated into the existing response filter criteria, so the table, Summary and downloads already run the same where-builder. Moving Responses onto `/api/v3/responses`, with a match count that stops at 10,000 and reads "10,000+" beyond that, is planned (ENG-6714).
- Quick-filter value lists come from a bounded per-property endpoint, never from loading every row. Responses is the exception for now: its attribute, hidden-field and meta values still come from reading the survey's responses, so that read runs only once the Filter menu opens or the URL names such a property (moving it to a bounded endpoint is ENG-6714).
