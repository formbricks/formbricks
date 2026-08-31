import { Logger } from "@/lib/common/logger";
import { type TTrackProperties } from "@/types/survey";

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
    // Guarded rather than thrown: this is the one SDK entry point outside the command queue's
    // `wrapThrowsAsync` shield (it is deliberately synchronous), and the GTM pattern this feature
    // targets can hand over an absent object — `setEmbeddedData(dataLayerObj)` on a page type where
    // that object is undefined. A broken tag is a worse failure than a skipped write. A primitive is
    // refused too, and so is an array (`typeof [] === "object"`): either would spread into junk
    // numeric keys ({0: "p", 1: "l", …} / {0: "a", 1: "b"}) — `ecommerce.items` is the common array case.
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      Logger.getInstance().error(
        `setEmbeddedData: expected an object, got ${data === null ? "null" : typeof data} — nothing was set`
      );
      return;
    }

    const set: string[] = [];
    const removed: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (value === null) {
        this.data.delete(key);
        removed.push(key);
        continue;
      }
      this.data.set(key, value);
      set.push(key);
    }

    // A success trace, because the bag is otherwise invisible: it lives in memory (nothing in
    // devtools storage) and the API has no getter, so without this line a developer wiring up GTM
    // gets zero confirmation until a survey happens to display. Debug level: it prints only with
    // `?formbricksDebug=true`, so respondents' consoles stay clean. Keys only, never values — the
    // documented use of this bag includes hashed identity fields.
    Logger.getInstance().debug(
      `setEmbeddedData: set [${set.join(", ")}]${removed.length > 0 ? `, removed [${removed.join(", ")}]` : ""} — the bag now holds [${[...this.data.keys()].join(", ")}]. Keys land on a response only if the survey declares them as ingested Embedded Data fields.`
    );
  }

  /**
   * Remove one key, or everything when called with no argument (logout / hard context switch).
   *
   * "No argument" and "an argument that evaluated to `undefined`" are deliberately different:
   * `setEmbeddedData` treats `undefined` as a no-op because GTM reads values off the data layer
   * unconditionally, and this method reads from the same dynamic source — so
   * `clearEmbeddedData(dataLayer.fieldToClear)` with the key absent must skip, not wipe the whole
   * bag. Only a literal zero-argument call clears everything.
   */
  public clearEmbeddedData(...args: [] | [key: string]): void {
    if (args.length === 0) {
      const clearedCount = this.data.size;
      this.data.clear();
      Logger.getInstance().debug(`clearEmbeddedData: cleared the whole bag (${String(clearedCount)} keys)`);
      return;
    }

    const [key] = args;
    if (typeof key !== "string") {
      Logger.getInstance().error(
        "clearEmbeddedData: expected a field name — nothing was cleared (call with no argument to clear everything)"
      );
      return;
    }

    this.data.delete(key);
    Logger.getInstance().debug(
      `clearEmbeddedData: removed "${key}" — the bag now holds [${[...this.data.keys()].join(", ")}]`
    );
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

/**
 * The display-time merge: the ambient bag under the explicit per-trigger `track({ hiddenFields })`
 * values, so an explicit write wins a shared key.
 *
 * Bag keys are folded case-INsensitively against the explicit ones, because the ingest contract
 * matches declared names case-insensitively with exact-match-first: with a field declared `Plan`, a
 * bag entry `Plan` and a track entry `plan` would otherwise both survive a plain spread, and the
 * contract would then pick the bag's exact match — the ambient value silently beating the explicit
 * one. Folding here keeps "explicit beats ambient" true under every casing.
 *
 * The cast at the end: the renderer's contract accepts boolean/Date scalars the narrower legacy
 * `hiddenFields` type cannot spell, and normalizes them before anything is stored.
 */
export const buildDisplayHiddenFields = (
  explicit?: TTrackProperties["hiddenFields"]
): TTrackProperties["hiddenFields"] => {
  // A key present with value `undefined` is treated as absent, the same promise `setEmbeddedData`
  // makes: `track("evt", { hiddenFields: { plan: dataLayer.plan } })` on a page where `plan` is
  // missing must not evict the ambient value — counting the key as "present" would drop the bag's
  // entry in the fold and then spread `undefined` over it, losing the value entirely.
  const explicitEntries = Object.entries(explicit ?? {}).filter(([, value]) => value !== undefined);
  const explicitKeysFolded = new Set(explicitEntries.map(([key]) => key.toLowerCase()));
  const ambient = Object.entries(EmbeddedDataStore.getInstance().getSnapshot()).filter(
    ([key]) => !explicitKeysFolded.has(key.toLowerCase())
  );

  return {
    ...Object.fromEntries(ambient),
    ...Object.fromEntries(explicitEntries),
  } as TTrackProperties["hiddenFields"];
};
