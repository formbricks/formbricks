import { Config } from "@/lib/common/config";
import { CONTAINER_ID } from "@/lib/common/constants";
import { FORMBRICKS_EVENTS, emitFormbricksEvent } from "@/lib/common/events";
import { Logger } from "@/lib/common/logger";
import { executeRecaptcha, loadRecaptchaScript } from "@/lib/common/recaptcha";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import {
  filterSurveys,
  getLanguageCode,
  getStyling,
  shouldDisplayBasedOnPercentage,
  surveyHasSegmentFilters,
} from "@/lib/common/utils";
import { buildDisplayHiddenFields } from "@/lib/survey/embedded-data";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type TUserState, type TWorkspaceStateSurvey } from "@/types/config";
import { type TTrackProperties } from "@/types/survey";

let isSurveyRunning = false;

// The surveys currently on screen, so each "formbricks_survey_closed" can name its own. A set
// rather than a single id because a second survey can render over a live one: a fired TimeoutStack
// entry is never pruned, so a later `checkPageUrl` releases `isSurveyRunning` while the first
// survey is still up, and the renderer appends a second container instead of replacing the first.
// Ids are added when the widget actually renders — after the delay, after every skip check — so a
// survey that was never shown never reports a close.
const openSurveyIds = new Set<string>();

export const setIsSurveyRunning = (value: boolean): void => {
  isSurveyRunning = value;
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

  // Passed straight through, unfiltered: the Embedded Data ingest contract lives in the renderer now
  // (ENG-1845/2472), so the SDK is a dumb pipe and the four mobile SDKs inherit the same rules
  // without each shipping a copy. The renderer drops unknown and locked keys, coerces the rest, and
  // logs what it refused — and the server re-runs all of it on ingest.
  await renderWidget(survey, action, properties?.hiddenFields);
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
    openSurveyIds.add(survey.id);

    // Render-gated, paired with "formbricks_survey_closed" off the same set so a host counting opens
    // against closes cannot drift. Deliberately not gated on the display POST: the renderer only
    // logs a failed one and leaves the survey on screen, so waiting for persistence would report a
    // close for a survey that never reported an open — and a slow POST against a quick dismissal
    // would deliver the two out of order. What was persisted is the dashboard's Displays count; this
    // event is what the respondent saw.
    emitFormbricksEvent(FORMBRICKS_EVENTS.surveyShown, { surveyId: survey.id });

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
  }, survey.delay * 1000);

  if (action) {
    timeoutStack.add(action, timeoutId as unknown as number);
  }
};

export const closeSurvey = (surveyId?: string): void => {
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
          globalThis.window.formbricksSurveys.setNonce(storedNonce);
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

let isPreloaded = false;

export const preloadSurveysScript = (appUrl: string): void => {
  // Don't preload if already loaded or already preloading
  if (globalThis.window.formbricksSurveys) return;
  if (isPreloaded) return;

  isPreloaded = true;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "script";
  link.href = `${appUrl}/js/surveys.umd.cjs`;
  document.head.appendChild(link);
};
