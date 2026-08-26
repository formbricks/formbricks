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

export const emitFormbricksEvent = (event: TFormbricksEventName, payload: TFormbricksEventPayload): void => {
  // js-core is imported by SSR bundles; emitting is meaningless (and crashes) off the browser.
  if (globalThis.window === undefined) return;

  window.dispatchEvent(new CustomEvent<TFormbricksEventPayload>(event, { detail: payload }));

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, formbricks: payload });
};
