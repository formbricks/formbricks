# Dashboard filters only narrow a chart's saved query

A dashboard filter, and the dashboard's date range, is ANDed onto each chart's saved query and never replaces a rule the chart's author saved, even on the same field: a chart saved for products A and B shows nothing when a viewer picks C. The chart's saved query is the outer bound of what anyone opening the dashboard can see, which is what makes the Dashboard viewer role safe, and the same holds for each filter's value list, drawn only from what the dashboard's charts let through. This reverses the "dashboard filter overrides the chart's own filter" product decision on ENG-4058 and the date range's replace behaviour from ENG-1553, both unreleased on the public API when this was decided.

## Considered Options

- **Override the chart's own rule on the same field**: what a viewer usually expects, rejected because a viewer could widen a chart past its author's scope.
- **Override only top-level rules, intersect nested ones**: keeps OR groups intact, rejected for the same reason.

## Consequences

- Charts can come back empty under a filter pick; the chart says why instead of showing all data.
- `GET /api/v3/charts/{id}/data` with a date range narrows the saved range rather than replacing it.
- Narrowing does not hide what a filter reveals inside a chart's scope: a `contains` filter on a free-text field can expose matching counts. Editors choose which fields become dashboard filters.
