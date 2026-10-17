import { getAppearance } from "@/lib/common/appearance";
import { Config } from "@/lib/common/config";
import { CONTAINER_ID, LIVE_REGION_ID } from "@/lib/common/constants";
import { FORMBRICKS_EVENTS, emitFormbricksEvent } from "@/lib/common/events";
import { Logger } from "@/lib/common/logger";
import { executeRecaptcha, loadRecaptchaScript } from "@/lib/common/recaptcha";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import {
  filterSurveys,
  getBrowserLanguageCodes,
  getCustomCss,
  getPageFont,
  getStyling,
  shouldDisplayBasedOnPercentage,
  surveyHasSegmentFilters,
} from "@/lib/common/utils";
import { buildDisplayHiddenFields } from "@/lib/survey/embedded-data";
import { type TLanguageResolver, chooseSurveyLanguage, resolveLanguageExactly } from "@/lib/survey/language";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type TUserState, type TWorkspaceStateSurvey } from "@/types/config";
import { type TTrackProperties } from "@/types/survey";

let isSurveyRunning = false;

// The surveys currently on screen, so each "formbricks_survey_closed" can name its own. Normally
// one, since `isSurveyRunning` is now held for as long as a survey is up (ENG-2849) — but a set
// rather than a single id because the renderer appends containers instead of replacing them, so
// nothing here gets to assume it. Ids are added when the widget actually renders — after the delay,
// after every skip check — so a survey that was never shown never reports a close.
const openSurveyIds = new Set<string>();

// The survey a creative's click is opening while nothing is on screen yet (identification, renderer
// load). A second press treats it as open (see `getOpenSurveyIds`), so it is not opened twice. A survey
// its own trigger is preparing, or delaying, is not open: a press opens it now (ADR 0004).
let surveyInFlight: string | null = null;

// Bumped by every creative click (ADR 0004: the click wins). A render already on its way when the click
// lands sees its generation go stale and stops before it shows anything or touches the shared flags.
let renderGeneration = 0;

/** Who asked for a survey other than its own triggers. */
interface TSurveyOpener {
  /** The creative whose click opens it (ENG-3994); the renderer sends it with the display (ENG-4001). */
  creativeId: string;
}

export const setIsSurveyRunning = (value: boolean): void => {
  isSurveyRunning = value;
  if (!value) surveyInFlight = null;
};

/** The surveys on screen, plus one a creative's click has on its way there. */
export const getOpenSurveyIds = (): string[] =>
  surveyInFlight === null || openSurveyIds.has(surveyInFlight)
    ? [...openSurveyIds]
    : [...openSurveyIds, surveyInFlight];

type TInteractionSource = keyof NonNullable<TWorkspaceStateSurvey["interactionRefresh"]>;

/**
 * Refresh server-computed segment membership after a survey interaction (display / response / finish).
 *
 * A `surveyInteraction` segment can change who a contact is in the moment they interact (e.g. "have
 * seen X", "have completed X"), so we pull fresh `segments` instead of waiting for the state TTL.
 * But that refresh is a heavy `/user` recompute, so it is:
 *   - Gated per survey and per event via `survey.interactionRefresh`: only interactions that can
 *     actually change some live survey's membership trigger a refetch. E.g. a survey referenced only
 *     by a "have seen" filter refreshes on display but not on response/finish, and a survey referenced
 *     by no interaction filter never refreshes.
 *   - Routed through the UpdateQueue instead of a raw `sendUpdates`: the display → response → finish
 *     burst coalesces into a single debounced call, and the ordered flush removes the last-writer-wins
 *     race that concurrent `void sendUpdates` calls had (a stale snapshot could clobber fresh state).
 *
 * No-op for anonymous users (no `userId`) and when the interaction can't change membership.
 */
const refreshSegmentsAfterInteraction = (
  userId: string | null,
  survey: TWorkspaceStateSurvey,
  source: TInteractionSource
): void => {
  if (!userId) return;

  const shouldRefresh = survey.interactionRefresh?.[source] ?? false;
  if (!shouldRefresh) return;

  const updateQueue = UpdateQueue.getInstance();
  updateQueue.updateUserId(userId);
  void updateQueue.processUpdates();
};

export const triggerSurvey = async (
  survey: TWorkspaceStateSurvey,
  action?: string,
  properties?: TTrackProperties
): Promise<void> => {
  const logger = Logger.getInstance();

  // Check if the survey should be displayed based on displayPercentage
  if (survey.displayPercentage) {
    const shouldDisplaySurvey = shouldDisplayBasedOnPercentage(survey.displayPercentage);
    if (!shouldDisplaySurvey) {
      logger.debug(`Survey display of "${survey.id}" skipped based on displayPercentage.`);
      return; // skip displaying the survey
    }
  }

  // Passed straight through, unfiltered: the Embedded Data ingest contract lives in the renderer now
  // (ENG-1845/2472), so the SDK is a dumb pipe and the four mobile SDKs inherit the same rules
  // without each shipping a copy. The renderer drops unknown and locked keys, coerces the rest, and
  // logs what it refused — and the server re-runs all of it on ingest.
  await renderWidget(survey, action, properties?.hiddenFields);
};

/**
 * Shows a survey. Its triggers call it with the `action` that fired; a creative's click calls it with an
 * `opener` (through `openSurveyForCreative`), which skips everything that decides whether and when the
 * survey shows: the one-survey-at-a-time guard, segment filters, the delay and auto-close (ADR 0004).
 */
export const renderWidget = async (
  survey: TWorkspaceStateSurvey,
  action?: string,
  hiddenFieldsObject?: TTrackProperties["hiddenFields"],
  opener?: TSurveyOpener
): Promise<void> => {
  const logger = Logger.getInstance();
  const config = Config.getInstance();
  const timeoutStack = TimeoutStack.getInstance();

  if (isSurveyRunning && !opener) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }

  setIsSurveyRunning(true);
  surveyInFlight = opener ? survey.id : null;

  const generation = renderGeneration;
  const isSuperseded = (): boolean => generation !== renderGeneration;
  // A superseded render leaves the guard alone: it belongs to the click that superseded it.
  const release = (): void => {
    if (!isSuperseded()) setIsSurveyRunning(false);
  };

  // Wait for pending user identification to complete before rendering
  const updateQueue = UpdateQueue.getInstance();
  if (updateQueue.hasPendingWork()) {
    logger.debug("Waiting for pending user identification before rendering survey");
    const identificationSucceeded = await updateQueue.waitForPendingWork();
    if (isSuperseded()) return;
    if (!identificationSucceeded) {
      const hasSegmentFilters = surveyHasSegmentFilters(survey);

      if (hasSegmentFilters && !opener) {
        logger.debug("User identification failed. Skipping survey with segment filters.");
        release();
        return;
      }

      logger.debug("User identification failed but survey has no segment filters. Proceeding.");
    }
  }

  const delaySeconds = opener ? 0 : survey.delay;
  if (delaySeconds) {
    logger.debug(`Delaying survey "${survey.id}" by ${delaySeconds.toString()} seconds.`);
  }

  const { settings } = config.get().workspace.data;
  const { language } = config.get().user.data;

  const workspaceOverwrites = survey.workspaceOverwrites ?? {};
  const clickOutside = workspaceOverwrites.clickOutsideClose ?? settings.clickOutsideClose;
  const overlay = workspaceOverwrites.overlay ?? settings.overlay;
  const placement = workspaceOverwrites.placement ?? settings.placement;
  const isBrandingEnabled = settings.inAppSurveyBranding;

  let formbricksSurveys: TFormbricksSurveys;
  try {
    formbricksSurveys = await loadFormbricksSurveysExternally();
  } catch (error) {
    logger.error(`Failed to load surveys library: ${String(error)}`);
    release();
    return;
  }
  if (isSuperseded()) return;

  // Resolved here, after the surveys bundle loads but before anything is scheduled, recorded or shown:
  // a skip below leaves no display, event or timeout behind, only the released `isSurveyRunning`.
  const languageCode = resolveDisplayLanguage(survey, language, formbricksSurveys);
  if (!languageCode) {
    logger.debug(`Survey "${survey.id}" is not available in specified language.`);
    release();
    return;
  }

  const recaptchaSiteKey = config.get().workspace.data.recaptchaSiteKey;
  const isSpamProtectionEnabled = Boolean(recaptchaSiteKey && survey.recaptcha?.enabled);

  const getRecaptchaToken = (): Promise<string | null> => {
    return executeRecaptcha(recaptchaSiteKey);
  };

  if (isSpamProtectionEnabled && recaptchaSiteKey) {
    await loadRecaptchaScript(recaptchaSiteKey);
    if (isSuperseded()) return;
  }

  const timeoutId = setTimeout(() => {
    if (isSuperseded()) return;

    // First, before anything below can throw: from here the survey is on screen, so its TimeoutStack
    // entry must stop looking like a cancellable schedule. `checkPageUrl` releases `isSurveyRunning`
    // for the entries it cancels, and doing that to a live survey lets the next trigger render a
    // second one over it (ENG-2849).
    timeoutStack.markFired(timeoutId as unknown as number);

    surveyInFlight = null;
    openSurveyIds.add(survey.id);

    // Render-gated, paired with "formbricks_survey_closed" off the same set so a host counting opens
    // against closes cannot drift. Deliberately not gated on the display POST: the renderer only
    // logs a failed one and leaves the survey on screen, so waiting for persistence would report a
    // close for a survey that never reported an open — and a slow POST against a quick dismissal
    // would deliver the two out of order. What was persisted is the dashboard's Displays count; this
    // event is what the respondent saw.
    emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: survey.id });

    formbricksSurveys.renderSurvey({
      appearance: getAppearance(),
      appUrl: config.get().appUrl,
      workspaceId: config.get().workspaceId,
      contactId: config.get().user.data.contactId ?? undefined,
      action,
      // Sent with the display and the response, so both record the creative (ENG-4001).
      creativeId: opener?.creativeId,
      // A creative's click opens the survey until the visitor closes it: no auto-close.
      survey: opener ? { ...survey, autoClose: null } : survey,
      isBrandingEnabled,
      clickOutside,
      overlay,
      languageCode,
      placement,
      styling: getStyling(settings, survey),
      // Only the web SDK passes it: an app survey on a web page is the one with a page font to take.
      pageFont: getPageFont(settings, survey),
      // Both scopes from the cached workspace state; the renderer applies CSS from this prop only.
      customCss: getCustomCss(settings, survey),
      // The ambient Embedded Data bag (ENG-1844) under the per-trigger `track({ hiddenFields })`
      // values — explicit beats ambient, case-insensitively (see `buildDisplayHiddenFields`).
      // Built here, inside the delay timeout at the moment the survey actually shows, from a
      // detached copy: a later `setEmbeddedData` affects the next response, never this one.
      hiddenFieldsRecord: buildDisplayHiddenFields(hiddenFieldsObject),
      recaptchaSiteKey,
      isSpamProtectionEnabled,
      getRecaptchaToken,
      onDisplayCreated: () => {
        const existingDisplays = config.get().user.data.displays;
        const newDisplay = { surveyId: survey.id, createdAt: new Date() };
        const displays = existingDisplays.length ? [...existingDisplays, newDisplay] : [newDisplay];
        const previousConfig = config.get();

        const updatedUserState: TUserState = {
          ...previousConfig.user,
          data: {
            ...previousConfig.user.data,
            displays,
            lastDisplayAt: new Date(),
          },
        };

        const filteredSurveys = filterSurveys(previousConfig.workspace, updatedUserState);

        config.update({
          ...previousConfig,
          workspace: previousConfig.workspace,
          user: updatedUserState,
          filteredSurveys,
        });

        // A new display can flip "have seen X" / "have not seen X" segments. The optimistic update
        // above keeps recontact/display-cap correct locally; this pulls fresh `segments` (gated +
        // coalesced) so interaction targeting is current by the time this survey closes and the next
        // trigger evaluates. The display is already persisted (fires after createDisplay).
        refreshSegmentsAfterInteraction(previousConfig.user.data.userId, survey, "onDisplay");
      },
      onResponseCreated: (responseId?: string) => {
        const responses = config.get().user.data.responses;
        const newPersonState: TUserState = {
          ...config.get().user,
          data: {
            ...config.get().user.data,
            responses: responses.length ? [...responses, survey.id] : [survey.id],
          },
        };

        const filteredSurveys = filterSurveys(config.get().workspace, newPersonState);

        config.update({
          ...config.get(),
          workspace: config.get().workspace,
          user: newPersonState,
          filteredSurveys,
        });

        // A created response flips "have started responding to X" segments. onResponseCreated fires
        // once, on the first answer (not on subsequent question submits — see survey.tsx), so this is
        // a single refresh covering "started". The "completed X" case is handled in onFinished below.
        refreshSegmentsAfterInteraction(config.get().user.data.userId, survey, "onResponse");

        // finished: false — completion gets its own emit in onFinished below. `responseId` comes
        // from the renderer's server-ack seam (ENG-1846 widened the callback), so it is real, not
        // client-minted — it is what lets the host link a session replay to this response. Emitted
        // last for the same reason as in onDisplayCreated: this callback runs inside the response
        // queue's try block, and a host-page throw here would mark a persisted response as failed.
        emitFormbricksEvent(FORMBRICKS_EVENTS.responseSubmitted, {
          surveyId: survey.id,
          responseId,
          finished: false,
        });
      },
      onFinished: (responseId?: string) => {
        // Survey completion flips "have completed X" (and clears "have not completed X") segments.
        // onFinished only fires after the finished response has been sent to the backend (it is gated
        // on isResponseSendingFinished), so the server recompute sees finished=true — no race. Without
        // this, a multi-question survey would only refresh at onResponseCreated (finished=false), so
        // "completed X → show Y" targeting would never fire until the person-state TTL expired.
        refreshSegmentsAfterInteraction(config.get().user.data.userId, survey, "onFinished");

        emitFormbricksEvent(FORMBRICKS_EVENTS.responseSubmitted, {
          surveyId: survey.id,
          responseId,
          finished: true,
        });
      },
      // Bound here, not passed as `closeSurvey`: the renderer calls onClose with no arguments, and
      // this closure is the only place that still knows which survey the container belongs to.
      onClose: () => {
        closeSurvey(survey.id);
      },
      getSetIsResponseSendingFinished: (_f: (value: boolean) => void) => undefined,
    });
  }, delaySeconds * 1000);

  if (action) {
    timeoutStack.add(action, timeoutId as unknown as number);
  }
};

/**
 * The click path (ADR 0004, decided 16 Oct): opens the survey a creative was pressed for, right away.
 * `close` is what `resolveClick` says to close first — the surveys on screen, each reported as closed —
 * and anything still on its way to the screen (a delay, a renderer load) is called off for good.
 */
export const openSurveyForCreative = async (
  survey: TWorkspaceStateSurvey,
  creativeId: string,
  close: readonly string[]
): Promise<void> => {
  renderGeneration += 1;

  const timeoutStack = TimeoutStack.getInstance();
  for (const { timeoutId, fired } of [...timeoutStack.getTimeouts()]) {
    if (!fired) timeoutStack.remove(timeoutId);
  }
  for (const surveyId of close) closeSurvey(surveyId);

  await renderWidget(survey, undefined, undefined, { creativeId });
};

export const closeSurvey = (surveyId?: string): void => {
  const config = Config.getInstance();

  // remove the survey modal container from DOM
  removeWidgetContainer();
  // Dropping the container does not unmount the survey, so the renderer's custom CSS would outlive it.
  // Feature-detected: renderer bundles older than custom CSS have no such function and no such CSS.
  globalThis.window.formbricksSurveys?.removeCustomCss?.();

  const { workspace, user } = config.get();
  const filteredSurveys = filterSurveys(workspace, user);

  config.update({
    ...config.get(),
    workspace,
    user,
    filteredSurveys,
  });

  setIsSurveyRunning(false);

  // Last, so host handlers observe settled state. `surveyId` is the renderer's own onClose id; the
  // argument-less callers (tearDown on logout / error) close whatever is on screen. The delete both
  // drops the survey and answers "was it still open?", which is what keeps this exactly once per
  // rendered survey.
  for (const closedSurveyId of surveyId === undefined ? [...openSurveyIds] : [surveyId]) {
    if (!openSurveyIds.delete(closedSurveyId)) continue;
    emitFormbricksEvent(FORMBRICKS_EVENTS.surveyClosed, { surveyId: closedSurveyId });
  }
};

export const addWidgetContainer = (): void => {
  const containerElement = document.createElement("div");
  containerElement.id = CONTAINER_ID;
  document.body.appendChild(containerElement);
};

/**
 * Mounts the persistent, visually hidden status region surveys announce their opening into
 * (a no-overlay survey never takes focus, so this is the only signal assistive tech gets).
 * Created at setup — not at survey open — because screen readers only reliably announce
 * changes made to a live region that already existed; a region inserted together with its
 * content is announced inconsistently. The surveys renderer writes the message
 * (packages/surveys/src/lib/live-region.ts) and re-creates the region if an older embed
 * script did not have this function.
 */
export const addLiveRegionContainer = (): void => {
  // The SDK can be imported (not just script-tagged) and evaluated during SSR.
  if (typeof document === "undefined") return;
  if (document.getElementById(LIVE_REGION_ID)) return;

  const liveRegion = document.createElement("div");
  liveRegion.id = LIVE_REGION_ID;
  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.style.cssText =
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
  document.body.appendChild(liveRegion);
};

export const removeWidgetContainer = (): void => {
  document.getElementById(CONTAINER_ID)?.remove();
};

const SURVEYS_LOAD_TIMEOUT_MS = 10000;
const SURVEYS_POLL_INTERVAL_MS = 200;

type TFormbricksSurveys = NonNullable<typeof globalThis.window.formbricksSurveys>;

/**
 * The language matcher for an app survey once the surveys bundle is loaded: its `resolveSurveyLanguage`,
 * which carries the canonical language table for the renderer (bundling it here would grow the SDK on
 * every customer page). A surveys bundle that predates the resolver (`/js/*` is CDN-cached for up to 30
 * days) gets the SDK's previous exact matcher, code then alias, as the final word, so explicit languages
 * keep working as they did before instead of every one of them being skipped.
 */
const toLanguageResolver = (formbricksSurveys: TFormbricksSurveys): TLanguageResolver =>
  formbricksSurveys.resolveSurveyLanguage ?? resolveLanguageExactly;

/**
 * The language a survey renders in, or `null` to skip it. An explicit language (`setLanguage()`) that
 * matches nothing skips the survey, as it always has; the browser languages only apply when no explicit
 * language is set and the survey uses browser language. Creatives hide by the same rule (ENG-4003), from
 * the survey languages the server precomputes for them.
 */
const resolveDisplayLanguage = (
  survey: TWorkspaceStateSurvey,
  language: string | undefined,
  formbricksSurveys: TFormbricksSurveys
): string | null =>
  chooseSurveyLanguage(
    survey,
    { explicit: language, browser: survey.autoSelectLanguage ? getBrowserLanguageCodes() : [] },
    toLanguageResolver(formbricksSurveys)
  );

let surveysLoadPromise: Promise<TFormbricksSurveys> | null = null;

/**
 * Content hash of the survey renderer this SDK was built against, inlined by the production build (see
 * `vite.config.ts`). `/js/*` is served with a 30-day `s-maxage` (`apps/web/next.config.mjs`), so without
 * a token that moves with the renderer a new SDK could be handed a month-old cached renderer, which
 * silently drops anything newer — creative attribution, for one. Absent in dev builds and tests.
 */
declare const __FB_SURVEY_RENDERER_HASH__: string;

/** The renderer URL, the same for the load and the prefetch so the load reuses the prefetched file. */
const getSurveysScriptUrl = (appUrl: string): string => {
  const version = typeof __FB_SURVEY_RENDERER_HASH__ === "string" ? __FB_SURVEY_RENDERER_HASH__ : "dev";
  return `${appUrl}/js/surveys.umd.cjs?v=${version}`;
};

const waitForSurveysGlobal = (): Promise<TFormbricksSurveys> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = (): void => {
      if (globalThis.window.formbricksSurveys) {
        const storedNonce = globalThis.window.__formbricksNonce;
        if (storedNonce) {
          globalThis.window.formbricksSurveys.setNonce?.(storedNonce);
        }
        resolve(globalThis.window.formbricksSurveys);
        return;
      }

      if (Date.now() - startTime >= SURVEYS_LOAD_TIMEOUT_MS) {
        reject(new Error("Formbricks Surveys library did not become available within timeout"));
        return;
      }

      setTimeout(check, SURVEYS_POLL_INTERVAL_MS);
    };

    check();
  });
};

export const loadFormbricksSurveysExternally = (): Promise<TFormbricksSurveys> => {
  if (globalThis.window.formbricksSurveys) {
    return Promise.resolve(globalThis.window.formbricksSurveys);
  }

  if (surveysLoadPromise) {
    return surveysLoadPromise;
  }

  surveysLoadPromise = new Promise<TFormbricksSurveys>((resolve, reject: (error: unknown) => void) => {
    const config = Config.getInstance();
    const script = document.createElement("script");
    script.src = getSurveysScriptUrl(config.get().appUrl);
    script.async = true;
    script.onload = () => {
      waitForSurveysGlobal()
        .then(resolve)
        .catch((error: unknown) => {
          surveysLoadPromise = null;
          console.error("Failed to load Formbricks Surveys library:", error);
          reject(new Error(`Failed to load Formbricks Surveys library`));
        });
    };
    script.onerror = (error) => {
      surveysLoadPromise = null;
      console.error("Failed to load Formbricks Surveys library:", error);
      reject(new Error(`Failed to load Formbricks Surveys library`));
    };
    document.head.appendChild(script);
  });

  return surveysLoadPromise;
};

let isPrefetched = false;

/**
 * Warms the browser cache with the surveys bundle so a triggered survey renders without a cold fetch.
 *
 * `prefetch`, not `preload`: preload claims the page needs the file now, so Chrome fetches it at high
 * priority and warns when it goes unused. Most page views never trigger a survey, so we were outbidding
 * the host page's own critical resources for a ~260 KB bundle we usually never run. The later <script>
 * reuses this fetch out of the plain HTTP cache — `/js/*` is served `public, max-age=3600` — so no `as`
 * is needed; Chrome ignores it on prefetch. Safari ignores prefetch itself, and fetches on trigger.
 */
export const prefetchSurveysScript = (appUrl: string): void => {
  // Don't prefetch if already loaded or already prefetching
  if (globalThis.window.formbricksSurveys) return;
  if (isPrefetched) return;

  isPrefetched = true;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = getSurveysScriptUrl(appUrl);
  document.head.appendChild(link);
};
