/**
 * Every reserved field name, lowercased — the blocklist a **newly authored** Embedded Data name is
 * refused for, because a field named `country` would be permanently shadowed by the reserved read of
 * the same name.
 *
 * **Why this is its own module, and a literal rather than a derivation.**
 *
 * It is a deliberate leaf: it imports nothing. The set is consumed by `ZEmbeddedData` in
 * embedded-data.ts, and deriving it from `RESERVED_FIELD_CATALOG` would make that schema module
 * depend on embedded-data-resolver.ts — which type-imports embedded-data.ts back, and whose own
 * imports reach surveys/validation.ts. Today those back-edges are type-only and erase at runtime, so
 * the cycle is latent rather than live; the first time anyone needs a *value* from embedded-data.ts
 * in the resolver it closes for real, and the failure mode is a half-initialized module during the
 * `z.object(...)` evaluation at import time — the kind of bug that shows up as an inexplicable
 * `undefined` in one bundler and not another. Keeping this a leaf makes that unreachable.
 *
 * It also cannot live in surveys/validation.ts next to `RESERVED_DECLARED_FIELD_NAMES`, for the same
 * reason from the other direction: embedded-data-resolver.ts imports `getTextContent` from there, so
 * importing the catalog back into it would close the cycle immediately.
 *
 * The cost is one duplicated list, and `embedded-data-resolver.test.ts` pays it down: an anti-drift
 * test asserts this set is exactly the catalog's names lowercased, so an entry added to one and not
 * the other fails the suite rather than shipping an unguarded name.
 *
 * **This is not `RESERVED_DECLARED_FIELD_NAMES`, and must never be merged into it.** That set is also
 * the capture-refusal list read by `getHiddenFieldsFromSearchParams`
 * (apps/web/modules/survey/link/lib/hidden-fields.ts): a param whose key is in it is dropped instead
 * of stored. Adding `country` there would stop `?country=DE` from filling the hidden field of a
 * survey that legitimately declares `country` today — silently breaking live data collection for a
 * survey nobody changed. These names are refused at *authoring* time only; whatever an existing
 * survey already declares keeps working, and keeps winning inside that survey.
 */
export const RESERVED_FIELD_NAMES: ReadonlySet<string> = new Set([
  "source",
  "url",
  "country",
  "action",
  "browser",
  "os",
  "devicetype",
  "ipaddress",
  "finished",
  "language",
  "responseid",
  "surveyid",
  "durationseconds",
  "startedat",
  "finishedat",
  // Browser-runtime context, auto-captured by the renderer and frozen at display (ENG-1841).
  "pagepath",
  "pagereferrer",
  "utmsource",
  "utmmedium",
  "utmcampaign",
  "utmterm",
  "utmcontent",
  "screenwidth",
  "screenheight",
  "viewportwidth",
  "viewportheight",
  "timezone",
]);
