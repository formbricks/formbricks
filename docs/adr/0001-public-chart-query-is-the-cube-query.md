# The public chart query is the Cube query

The Dashboard & Chart API (ENG-3928) exposes a chart's query in the same Cube.js format we store and the app's builder and AI generator already write, rather than a Formbricks chart spec translated on the server: the app moves onto the same API, so a second model would have to be kept in sync with the builder, and anything it could not express could not be built. Field names keep their source prefix (`FeedbackRecords.npsScore`) because the prefix names the data source, and charts over other sources are expected; a bare-name map at the API edge would have to be re-namespaced the day a second source arrives.

## Considered Options

- **Our own chart spec** (`measure`, `groupBy`, `over`): friendlier to agents and independent of Cube, rejected as a second model to keep in sync with the builder.
- **Cube query marked unstable**: only worth it if we already knew we would replace the format.
- **Bare field names through a map at the API edge**: shorter names and freedom to restructure Cube, rejected because it collides with future data sources.

## Consequences

- The query is tightened for public callers: members are checked against the field catalog, Cube options the app never uses are rejected, and filter depth, counts and `limit` are bounded.
- Renaming or splitting the `FeedbackRecords` Cube model is now a breaking API change.
