# Dashboard filters only narrow a chart's saved query

A dashboard filter is ANDed onto each chart's saved query and never replaces a rule the chart's author saved, even on the same field: a chart saved for products A and B shows nothing when a viewer picks C. Apart from its period, the chart's saved query is the outer bound of what anyone opening the dashboard can see, which is what makes the Dashboard viewer role safe, and the same holds for each filter's value list, drawn only from what the dashboard's charts let through. This reverses the "dashboard filter overrides the chart's own filter" product decision on ENG-4058, unreleased on the public API when this was decided.

The date range is the one exception: it takes the place of the range saved on a chart's "Collected at" time dimension, so a viewer can look at any period, earlier or later than the chart's author chose. A range fixed by the author would leave viewers unable to answer the obvious next question about the same data. The range is each person's own, kept in the URL and a cookie like the filter picks, never saved on the dashboard. A chart grouped by time keeps its saved range under "All time", because a bucket for every day of all time is more than the time-bucket limit allows.

## Considered Options

- **Override the chart's own rule on the same field**: what a viewer usually expects, rejected because a viewer could widen a chart past its author's scope.
- **Override only top-level rules, intersect nested ones**: keeps OR groups intact, rejected for the same reason.

## Consequences

- Charts can come back empty under a filter pick; the chart says why instead of showing all data.
- `GET /api/v3/charts/{id}/data` with a date range replaces the saved range, as the dashboard does. A range on a rule the author saved on `collectedAt` as a filter (not as the time dimension's range) still narrows.
- Narrowing does not hide what a filter reveals inside a chart's scope: a `contains` filter on a free-text field can expose matching counts. Editors choose which fields become dashboard filters.
- Accepted risk: embedded-data keys keep value lists, so a filter on a key such as `email` lists those values to everyone who can open the dashboard, Dashboard viewers included. Free-text fields get no value list; embedded keys do because they are usually categorical, and an editor who adds a filter on one chooses to show its values. The dashboards docs warn about it.
