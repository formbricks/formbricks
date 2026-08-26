/** What a host page may hand to `setEmbeddedData`. `null` removes the key; `undefined` is a no-op. */
export type TEmbeddedDataInput = Record<string, string | number | boolean | Date | null | undefined>;

/**
 * The in-memory Embedded Data bag (ENG-1844): context a host page attaches to future responses
 * without tying it to a trigger — `formbricks.setEmbeddedData({ pageType: "product" })` from GTM
 * instead of repeating the same values on every possible `track()` call.
 *
 * Lifetime rules, all deliberate:
 *
 * - **In-memory, page-load scoped, never persisted.** Not `Config`: that class writes to
 *   localStorage, and persisting this bag would blur the Embedded Data ↔ contact-attribute boundary
 *   and create a stale-data / PII-at-rest surface. A full page load starts empty; the host re-pushes
 *   (which a classic MPA does for free on every load, and an SPA must do on route change).
 * - **Snapshot at display, then frozen.** `renderWidget` copies the bag into the survey's
 *   `hiddenFieldsRecord` when the survey is shown; a later `setEmbeddedData` affects the next
 *   response, never the one on screen.
 * - **No filtering here.** The SDK is a dumb pipe (ENG-1845/2472): the renderer applies the ingest
 *   contract — allow-list, coercion, `locked`, size caps — and logs what it refuses, and the server
 *   re-runs all of it on ingest. Filtering in js-core would ship a second copy of those rules that
 *   the four mobile SDKs could drift from.
 * - **No network.** Every method is a synchronous memory write, so calling `setEmbeddedData` on
 *   every route change is free. Values ride the existing response payload.
 *
 * Backed by a `Map` rather than a plain object so a `__proto__` key is stored as data instead of
 * vanishing into the prototype — the same hole the ingest contract closes on the renderer side.
 */
export class EmbeddedDataStore {
  private static instance: EmbeddedDataStore | undefined;
  private data = new Map<string, string | number | boolean | Date>();

  static getInstance(): EmbeddedDataStore {
    EmbeddedDataStore.instance ??= new EmbeddedDataStore();
    return EmbeddedDataStore.instance;
  }

  /**
   * Merge — never replace — so refreshing a volatile field (`pageType`) cannot wipe the stable ones
   * (`plan`) set at page load. Per key: last write wins; `null` removes; `undefined` does nothing.
   *
   * The `undefined` no-op is a documented promise, not an accident: the GTM integration reads keys
   * off the data layer and passes every field unconditionally, so a key absent on the current page
   * type arrives as `undefined` and must not clear the value a previous page set.
   */
  public setEmbeddedData(data: TEmbeddedDataInput): void {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (value === null) {
        this.data.delete(key);
        continue;
      }
      this.data.set(key, value);
    }
  }

  /** Remove one key, or everything when called without one (logout / hard context switch). */
  public clearEmbeddedData(key?: string): void {
    if (key === undefined) {
      this.data.clear();
      return;
    }
    this.data.delete(key);
  }

  /**
   * A detached copy for the display-time snapshot: mutating the bag after a survey rendered must not
   * reach that survey's response. `Object.fromEntries` defines own properties, so a `__proto__` key
   * survives the conversion as data.
   */
  public getSnapshot(): Record<string, string | number | boolean | Date> {
    return Object.fromEntries(this.data);
  }
}
