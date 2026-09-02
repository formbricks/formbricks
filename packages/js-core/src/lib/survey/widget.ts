import { Config } from "@/lib/common/config";
import { CONTAINER_ID, LIVE_REGION_ID } from "@/lib/common/constants";
import { Logger } from "@/lib/common/logger";
import { executeRecaptcha, loadRecaptchaScript } from "@/lib/common/recaptcha";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import {
  filterSurveys,
  getLanguageCode,
  getStyling,
  handleHiddenFields,
  shouldDisplayBasedOnPercentage,
  surveyHasSegmentFilters,
} from "@/lib/common/utils";
import { SurveyLifecycleEmitter } from "@/lib/survey/lifecycle";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type TUserState, type TWorkspaceStateSurvey } from "@/types/config";
import { type TSurveyLifecycleEventType, type TTrackProperties } from "@/types/survey";

let isSurveyRunning = false;

// The survey handed to the renderer, held only while it is on screen. `closeSurvey` is the single
// close path — the renderer's onClose, and tearDown on logout / error — but it is called without
// arguments, so this is what lets the "closed" lifecycle event name the survey it belongs to. It is
// set when the widget actually renders (after the delay, after every skip check), so a survey that
// was never shown never reports a close.
let activeSurveyId: string | null = null;

export const setIsSurveyRunning = (value: boolean): void => {
  isSurveyRunning = value;
};

const emitLifecycleEvent = (type: TSurveyLifecycleEventType, surveyId: string): void => {
  SurveyLifecycleEmitter.getInstance().emit({ type, surveyId });
};

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

  const hiddenFieldsObject: TTrackProperties["hiddenFields"] = handleHiddenFields(
    survey.hiddenFields,
    properties?.hiddenFields
  );

  await renderWidget(survey, action, hiddenFieldsObject);
};

export const renderWidget = async (
  survey: TWorkspaceStateSurvey,
  action?: string,
  hiddenFieldsObject?: TTrackProperties["hiddenFields"]
): Promise<void> => {
  const logger = Logger.getInstance();
  const config = Config.getInstance();
  const timeoutStack = TimeoutStack.getInstance();

  if (isSurveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }

  setIsSurveyRunning(true);

  // Wait for pending user identification to complete before rendering
  const updateQueue = UpdateQueue.getInstance();
  if (updateQueue.hasPendingWork()) {
    logger.debug("Waiting for pending user identification before rendering survey");
    const identificationSucceeded = await updateQueue.waitForPendingWork();
    if (!identificationSucceeded) {
      const hasSegmentFilters = surveyHasSegmentFilters(survey);

      if (hasSegmentFilters) {
        logger.debug("User identification failed. Skipping survey with segment filters.");
        setIsSurveyRunning(false);
        return;
      }

      logger.debug("User identification failed but survey has no segment filters. Proceeding.");
    }
  }

  if (survey.delay) {
    logger.debug(`Delaying survey "${survey.id}" by ${survey.delay.toString()} seconds.`);
  }

  const { settings } = config.get().workspace.data;
  const { language } = config.get().user.data;

  const isMultiLanguageSurvey = survey.languages.length > 1;
  let languageCode = "default";

  if (isMultiLanguageSurvey) {
    const displayLanguage = getLanguageCode(survey, language);
    //if survey is not available in selected language, survey wont be shown
    if (!displayLanguage) {
      logger.debug(`Survey "${survey.id}" is not available in specified language.`);
      setIsSurveyRunning(false);
      return;
    }

    languageCode = displayLanguage;
  }

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
    setIsSurveyRunning(false);
    return;
  }

  const recaptchaSiteKey = config.get().workspace.data.recaptchaSiteKey;
  const isSpamProtectionEnabled = Boolean(recaptchaSiteKey && survey.recaptcha?.enabled);

  const getRecaptchaToken = (): Promise<string | null> => {
    return executeRecaptcha(recaptchaSiteKey);
  };

  if (isSpamProtectionEnabled && recaptchaSiteKey) {
    await loadRecaptchaScript(recaptchaSiteKey);
  }

  const timeoutId = setTimeout(() => {
    activeSurveyId = survey.id;

    formbricksSurveys.renderSurvey({
      appUrl: config.get().appUrl,
      workspaceId: config.get().workspaceId,
      contactId: config.get().user.data.contactId ?? undefined,
      action,
      survey,
      isBrandingEnabled,
      clickOutside,
      overlay,
      languageCode,
      placement,
      styling: getStyling(settings, survey),
      hiddenFieldsRecord: hiddenFieldsObject,
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

        // Fires after the display was persisted, i.e. once the survey is on screen — not when the
        // triggering `track()` ran, which is the distinction the host needs to cap frequency on.
        emitLifecycleEvent("displayed", survey.id);
      },
      onResponseCreated: () => {
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

        // Once per survey, on the first answer: the renderer creates the response then and only
        // updates it on later submits (see survey.tsx).
        emitLifecycleEvent("responded", survey.id);
      },
      onFinished: () => {
        // Survey completion flips "have completed X" (and clears "have not completed X") segments.
        // onFinished only fires after the finished response has been sent to the backend (it is gated
        // on isResponseSendingFinished), so the server recompute sees finished=true — no race. Without
        // this, a multi-question survey would only refresh at onResponseCreated (finished=false), so
        // "completed X → show Y" targeting would never fire until the person-state TTL expired.
        refreshSegmentsAfterInteraction(config.get().user.data.userId, survey, "onFinished");
      },
      onClose: closeSurvey,
      getSetIsResponseSendingFinished: (_f: (value: boolean) => void) => undefined,
    });
  }, survey.delay * 1000);

  if (action) {
    timeoutStack.add(action, timeoutId as unknown as number);
  }
};

export const closeSurvey = (): void => {
  const config = Config.getInstance();

  // remove the survey modal container from DOM
  removeWidgetContainer();

  const { workspace, user } = config.get();
  const filteredSurveys = filterSurveys(workspace, user);

  config.update({
    ...config.get(),
    workspace,
    user,
    filteredSurveys,
  });

  setIsSurveyRunning(false);

  // Last, so a host handler observes settled state. Guarded on activeSurveyId: closeSurvey also runs
  // on paths where nothing is open (tearDown), and it must report each rendered survey exactly once.
  if (activeSurveyId) {
    const closedSurveyId = activeSurveyId;
    activeSurveyId = null;
    emitLifecycleEvent("closed", closedSurveyId);
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

let surveysLoadPromise: Promise<TFormbricksSurveys> | null = null;

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

const loadFormbricksSurveysExternally = (): Promise<TFormbricksSurveys> => {
  if (globalThis.window.formbricksSurveys) {
    return Promise.resolve(globalThis.window.formbricksSurveys);
  }

  if (surveysLoadPromise) {
    return surveysLoadPromise;
  }

  surveysLoadPromise = new Promise<TFormbricksSurveys>((resolve, reject: (error: unknown) => void) => {
    const config = Config.getInstance();
    const script = document.createElement("script");
    script.src = `${config.get().appUrl}/js/surveys.umd.cjs`;
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
  link.href = `${appUrl}/js/surveys.umd.cjs`;
  document.head.appendChild(link);
};
