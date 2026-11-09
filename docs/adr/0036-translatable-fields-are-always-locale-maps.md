# Translatable survey fields are always locale-code maps, read and written as one document

A v3 survey carries every translation in the same document: each translatable field is a map keyed by real locale codes (`en-US`, `de-DE`), never the internal `default` key, and the survey names its `defaultLanguage`. Writes take the full multilingual document only. A plain string is not accepted as "the default language", every configured language must be present in every translatable field, and there is no per-language write (`PATCH ?lang`) and no translation sub-resource. `GET ?lang=de-DE,pt-PT` narrows the maps to the requested languages but never turns them into strings, so the response has one shape whatever the query. It accepts bare codes and workspace aliases, and refuses an ambiguous or unknown one with 400. Missing text falls back to the default language, field by field and silently. One explicit document is what agents edit most reliably, and it keeps validation in one place.

## Considered Options

- **Localized reads that return strings** (the original proposal): two response shapes for one resource, and a generated client has to model both.
- **Accept a string as default-language text on write**: friendlier for a monolingual survey, but ambiguous on a multilingual one and a second shape to validate.
- **Translation sub-resources, or per-language writes**: smaller updates, at the cost of a second write model. Left for explicit operations if a real need appears.

## Consequences

- A language a write references is created on the workspace if it doesn't exist yet, inside the same transaction, and must also be declared in the survey's `languages[]`. `/surveys/validate` reports which languages a write would create.
- Disabled but configured languages stay readable, so unfinished translations can be completed through the API.
- The fallback is not marked in the response, so a consumer can't tell a fallback string from a real translation.
- There is no survey version history. `?version` is refused as an unknown query parameter.
