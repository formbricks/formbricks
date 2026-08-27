/**
 * The SDK's outbound event bus (ENG-1846): lifecycle signals the host page can react to — fire
 * GA/GTM tags, link session replays, and (most importantly) know when the SDK is ready, which is
 * what makes a consent-delayed `setup()` integrable without polling for `window.formbricks`.
 *
 * Every event goes out on two transports:
 *
 * 1. **A `CustomEvent` on `window` — always.** The in-house pattern for host-facing signals
 *    (`formbricks:onFilePick`, the route-change events) and vendor-neutral: nothing accumulates,
 *    and no global we do not own is touched.
 * 2. **A `window.dataLayer.push` — via the standard GTM idiom** (`window.dataLayer = window.dataLayer
 *    || []`). The idiom survives load order: if GTM initialises after us it drains what is already
 *    queued, whereas pushing only when the array exists would silently drop every event emitted
 *    before GTM loads. Cost, accepted knowingly: a site with no GTM gets a `dataLayer` array that
 *    accumulates small event objects with nothing draining it.
 *
 * One underscored name per event, identical on both transports, published to integrators — the
 * constants hold the full literal so the string a customer's GTM trigger matches is greppable here.
 *
 * The payload is nested under a `formbricks` key on the dataLayer (instead of spread flat) because
 * GTM's Data Layer Variables read a *merged* model: a flat `action` or `finished` would persist
 * across pushes and collide with the host's own keys — `action` in particular is one of the most
 * common keys in any ecommerce dataLayer. `CustomEvent.detail` gives the same isolation for free.
 *
 * No PII: payloads carry ids and the `finished` boolean, never response content or scores.
 */
export const FORMBRICKS_EVENTS = {
  setupSuccessful: "formbricks_setup_successful",
  actionTracked: "formbricks_action_tracked",
  surveyShown: "formbricks_survey_shown",
  responseSubmitted: "formbricks_response_submitted",
} as const;

export type TFormbricksEventName = (typeof FORMBRICKS_EVENTS)[keyof typeof FORMBRICKS_EVENTS];

export type TFormbricksEventPayload = Record<string, string | number | boolean | undefined>;

/**
 * Every key the event contract can carry, `null` where an event does not set it. The dataLayer push
 * always carries the FULL set because GTM's data model merges pushes recursively — a partial push
 * would let a previous event's `formbricks.responseId` or `formbricks.finished` bleed into a later
 * event's reads (survey A's `responseId` resolving under survey B's `formbricks_survey_shown`).
 * Pushing `null` overwrites the merged value; omitting the key would not. `CustomEvent.detail` has
 * no merge semantics, so it carries only the event's own keys.
 */
const EMPTY_DATALAYER_PAYLOAD: Record<string, null> = {
  workspaceId: null,
  surveyId: null,
  responseId: null,
  finished: null,
  action: null,
};

export const emitFormbricksEvent = (event: TFormbricksEventName, payload: TFormbricksEventPayload): void => {
  // js-core is imported by SSR bundles; emitting is meaningless (and crashes) off the browser.
  if (globalThis.window === undefined) return;

  // Both transports run host-owned code — the page's event listeners, and `dataLayer.push`, which
  // GTM replaces with its own function once it loads. The emitter's call sites sit at the head of
  // SDK-critical paths (display bookkeeping, the response queue's ack), so a host-page throw here
  // must never escape: it would cost us display state or mark a persisted response as failed. Each
  // transport is isolated separately so one failing cannot silence the other.
  try {
    window.dispatchEvent(new CustomEvent<TFormbricksEventPayload>(event, { detail: payload }));
  } catch (error) {
    console.error(`Formbricks: a "${event}" event listener threw`, error);
  }

  try {
    // `Array.isArray`, not `?? []`: a host page that set `window.dataLayer = {}` (a hand-rolled
    // shim, or another vendor reusing the name) survives nullish coalescing and then throws on
    // `.push`. GTM's own snippet only ever creates an array, and its loaded state keeps the array
    // and swaps the `push` method, so `Array.isArray` stays true on every real GTM page.
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    // Undefined-valued keys are stripped before the merge: `TFormbricksEventPayload` admits
    // `undefined` (the widened callbacks type `responseId` optional), and a key PRESENT with value
    // `undefined` would replace the `null` sentinel in the spread — re-opening the recursive-merge
    // bleed the sentinel exists to stop.
    const definedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    );
    window.dataLayer.push({ event, formbricks: { ...EMPTY_DATALAYER_PAYLOAD, ...definedPayload } });
  } catch (error) {
    console.error(`Formbricks: failed to push "${event}" to the dataLayer`, error);
  }
};
