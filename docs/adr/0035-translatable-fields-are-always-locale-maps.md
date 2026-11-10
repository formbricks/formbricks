# Translatable survey fields are always locale-code maps, read and written as one document

Every translatable field in a v3 survey is a map keyed by real locale codes (`en-US`, `de-DE`), on reads and on writes, and every translation travels in the same document. A write never takes a plain string as "the default language", must leave every configured language present in every translatable field (a gap already stored is tolerated until the write touches it, so adding a language means translating the whole survey), and has no per-language form (`PATCH ?lang`) or translation sub-resource. `GET ?lang=de-DE` narrows the maps but never turns them into strings, so the response has one shape whatever the query. One explicit document is what agents edit most reliably, and it keeps validation in one place.

## Considered Options

- **Localized reads that return strings**: two shapes for one resource, which every generated client has to model.
- **Accept a string as default-language text on write**: friendlier for a monolingual survey, ambiguous on a multilingual one.
- **Translation sub-resources or per-language writes**: smaller updates, at the cost of a second write model.

## Consequences

- A locale must be the survey's `defaultLanguage` or declared in its `languages` before content can use it. A declared language missing from the workspace is created there, rather than refused.
- Under `?lang`, missing text falls back to the default language field by field, and the response doesn't say so.
