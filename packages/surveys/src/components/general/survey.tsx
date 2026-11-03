import { type JSX } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { applyIngestContract } from "@formbricks/types/embedded-data-ingest";
import {
  RESERVED_FIELD_CATALOG,
  buildEmbeddedLookup,
  coerceToEmbeddedDataType,
  dropShadowedReservedEntries,
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
  getSurveyEmbeddedFields,
  listShadowingNames,
  mergeReservedValues,
  projectClientReservedValues,
} from "@formbricks/types/embedded-data-resolver";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { TJsFileUploadParams, type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import type {
  TResponseData,
  TResponseTtc,
  TResponseUpdate,
  TResponseVariables,
} from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { getLinkSurveyCardMaxWidth } from "@formbricks/types/styling";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { getNotShownElementIds } from "@formbricks/types/surveys/not-shown";
import { withOptionsShown } from "@formbricks/types/surveys/show-if";
import { BlockConditional } from "@/components/general/block-conditional";
import { EndingCard } from "@/components/general/ending-card";
import { ErrorComponent } from "@/components/general/error-component";
import { FormbricksBranding } from "@/components/general/formbricks-branding";
import { LanguageSwitch } from "@/components/general/language-switch";
import { ProgressBar } from "@/components/general/progress-bar";
import { RecaptchaBranding } from "@/components/general/recaptcha-branding";
import { ResponseErrorComponent } from "@/components/general/response-error-component";
import { Subheader } from "@/components/general/subheader";
import {
  SURVEY_CLOSE_BUTTON_HEADLINE_CLEARANCE_CLASS_NAME,
  SURVEY_CLOSE_BUTTON_ROW_CLASS_NAME,
  SURVEY_CLOSE_BUTTON_SCROLL_FADE_CLASS_NAME,
  SurveyCloseButton,
} from "@/components/general/survey-close-button";
import { WelcomeCard } from "@/components/general/welcome-card";
import { AutoCloseWrapper } from "@/components/wrappers/auto-close-wrapper";
import { CardlessSurveyLayout } from "@/components/wrappers/cardless-survey-layout";
import { StackedCardsContainer } from "@/components/wrappers/stacked-cards-container";
import { ApiClient } from "@/lib/api-client";
import {
  advanceFromBlock,
  enterBlock,
  getPageAnswers,
  getPageVisibility,
  startSurvey,
} from "@/lib/block-flow";
import { type TWebSurveyMeta, createWebSurveyMetaSnapshot } from "@/lib/browser-context";
import { getCardStartsWithMedia } from "@/lib/card-header";
import { getLocalizedValue } from "@/lib/i18n";
import { INGEST_DROP_MESSAGES, logIngestResult } from "@/lib/ingest-logging";
import { type TNotShownStep, appendNotShownStep, buildNotShownRecord } from "@/lib/not-shown-record";
import {
  type SerializedSurveyState,
  clearSurveyProgress,
  getSurveyProgress,
  patchSurveyProgressSnapshot,
  saveSurveyProgress,
} from "@/lib/offline-storage";
import { parseRecallInformation, replaceRecallInfo } from "@/lib/recall";
import { ResponseQueue } from "@/lib/response-queue";
import { getPreviousBlockId, getRestorableHistory, isFinishedBlockId } from "@/lib/survey-navigation";
import { SURVEY_INSTRUCTIONS_ID, getSurveyPagePosition, hasSurveyInstructions } from "@/lib/survey-page";
import { SurveyState } from "@/lib/survey-state";
import { useOnlineStatus } from "@/lib/use-online-status";
import { cn, findBlockByElementId, getDefaultLanguageCode, getElementsFromSurveyBlocks } from "@/lib/utils";
import { TResponseErrorCodesEnum } from "@/types/response-error-codes";

const restoreSurveyStateFromSnapshot = (
  surveyState: SurveyState,
  snapshot: SerializedSurveyState,
  progress: {
    responseData: TResponseData;
    ttc: TResponseTtc;
    currentVariables: TResponseVariables;
  }
): void => {
  if (snapshot.responseId) surveyState.updateResponseId(snapshot.responseId);
  if (snapshot.displayId) surveyState.updateDisplayId(snapshot.displayId);
  if (snapshot.userId) surveyState.updateUserId(snapshot.userId);
  if (snapshot.contactId) surveyState.updateContactId(snapshot.contactId);
  if (snapshot.singleUseId) surveyState.singleUseId = snapshot.singleUseId;
  surveyState.disableBootstrapResponseCreate();
  surveyState.responseAcc = {
    ...snapshot.responseAcc,
    data: progress.responseData,
    ttc: progress.ttc,
    variables: progress.currentVariables,
    displayId: snapshot.displayId ?? snapshot.responseAcc.displayId,
  };
};

interface VariableStackEntry {
  questionId: string;
  variables: TResponseVariables;
}

// Close-button and language-switch hover tint. Read through a variable so the dark palette can
// replace it; light mode resolves to the same literal as before (ENG-2939).
const getHoverColor = (styling: SurveyContainerProps["styling"]) =>
  `var(--fb-hover-bg-color, ${styling.inputBgColor?.light ?? "#f8fafc"})`;

/**
 * The computed fields seeded from their definitions in the EmbeddedData tables (ENG-1837).
 *
 * Provably the variable's declared value for every field derived from the legacy shape:
 * ZSurveyVariable pins a number variable to a number and a text one to a string, and both are
 * pass-throughs here (see the seeding test in embedded-data-mapping.test.ts). Booleans and dates have
 * no slot in TResponseVariables and no computed field can carry one.
 */
const seedComputedVariables = (
  embeddedFields: TJsWorkspaceStateSurvey["embeddedFields"]
): TResponseVariables =>
  getComputedEmbeddedFields({ embeddedFields }).reduce<TResponseVariables>((acc, { field, link }) => {
    const seed = coerceToEmbeddedDataType(field.defaultValue, field.dataType);
    if (typeof seed === "string" || typeof seed === "number") acc[link.storageKey] = seed;
    return acc;
  }, {});

// Counts the displays mounted in this page, see `displayKey` in the response queue config.
let displayCounter = 0;

export function Survey({
  appUrl,
  workspaceId: workspaceIdProp,
  // Legacy SDKs (e.g. Android ≤ v1.2.0) pass `environmentId` instead of
  // `workspaceId`. Accept it as a fallback so their response submission works.
  environmentId,
  isPreviewMode = false,
  userId,
  contactId,
  mode,
  survey,
  styling,
  isBrandingEnabled,
  onDisplay,
  onResponse,
  onClose,
  onFinished,
  onRetry,
  onDisplayCreated,
  onResponseCreated,
  onOpenExternalURL,
  isRedirectDisabled = false,
  prefillResponseData,
  skipPrefilled,
  languageCode,
  getSetIsError,
  getSetIsResponseSendingFinished,
  getSetBlockId,
  getSetResponseData,
  responseCount,
  startAtQuestionId,
  hiddenFieldsRecord,
  shouldResetQuestionId,
  fullSizeCards = false,
  autoFocus,
  action,
  creativeId,
  visit,
  singleUseId,
  singleUseResponseId,
  pinAuthToken,
  isWebEnvironment = true,
  getRecaptchaToken,
  isSpamProtectionEnabled,
  dir = "auto",
  setDir,
  onLanguageChange,
  onPageChange,
  placement,
  offlineSupport = false,
  onOfflineStatusChange,
  showCardlessPreviewLogoSlot = false,
}: Readonly<SurveyContainerProps>) {
  const { t } = useTranslation();
  const workspaceId = workspaceIdProp ?? environmentId;
  let apiClient: ApiClient | null = null;

  if (appUrl && workspaceId) {
    apiClient = new ApiClient({
      appUrl,
      workspaceId,
    });
  }

  const surveyState = useMemo(() => {
    if (appUrl && workspaceId) {
      if (mode === "inline") {
        return new SurveyState(survey.id, singleUseId, singleUseResponseId, userId, contactId, pinAuthToken);
      }

      return new SurveyState(survey.id, null, null, userId, contactId, pinAuthToken);
    }
    return null;
  }, [
    appUrl,
    workspaceId,
    mode,
    survey.id,
    userId,
    singleUseId,
    singleUseResponseId,
    contactId,
    pinAuthToken,
  ]);

  // Update the responseQueue to use the stored responseId

  const [hasInteracted, setHasInteracted] = useState(false);

  const [localSurvey, setlocalSurvey] = useState<TJsWorkspaceStateSurvey>(survey);

  /**
   * The browser-runtime context, snapshotted **once on this survey's first render** and frozen for
   * the rest of its life. `onResponseCreateOrUpdate` runs on every submit, so reading the runtime
   * there — as this did before — meant a respondent who rotated their phone or resized the window
   * mid-survey silently rewrote the viewport the finished response reports.
   *
   * Lazy `useRef` initialisation is what makes "first render" the capture point. A survey with a
   * `delay` is not mounted until the widget actually renders it, so render time is the only moment
   * this component can reach — and it is the right one anyway: it is when the respondent first sees
   * the survey, not when some earlier action queued it.
   */
  const webSurveyMetaRef = useRef<(() => TWebSurveyMeta) | null>(null);
  webSurveyMetaRef.current ??= createWebSurveyMetaSnapshot(isWebEnvironment, visit);

  /**
   * The Embedded Data ingest contract (ENG-1845) applied to whatever the host handed us — URL params
   * for a link survey, `track({ hiddenFields })` or `setEmbeddedData` for an app one. Every caller
   * passes a raw bag and this is the one place it is filtered and coerced, so the SDKs stay dumb
   * pipes and the four mobile ones inherit the rules without shipping a copy (ENG-2472).
   *
   * In a lazy initialiser because it belongs to the display-time snapshot: the bag is read once, at
   * mount, like the browser-runtime context beside it. The values it produces are the ones the
   * respondent's logic and recall see, so they must not change under them mid-survey.
   *
   * Client-side enforcement is for immediate correctness and developer feedback only — the server
   * re-runs the same contract on ingest and recomputes the flags, because it cannot trust this.
   */
  const [ingestedFieldsRecord] = useState<TResponseData>(() => {
    const elementIds = getElementsFromSurveyBlocks(survey.blocks).map((element) => element.id);
    const result = applyIngestContract({
      incoming: hiddenFieldsRecord ?? {},
      ingestedFields: getIngestedEmbeddedFields(survey),
      elementIds,
      // This record is what the queue sends, so cutting here would hand the server a value that
      // already fits — and the server's re-run is what produces the persisted flags, so the
      // `truncated` verdict would be lost on the only path the feature actually ships on. The flag is
      // still raised below for the console; the server does the cutting.
      enforceSizeLimit: false,
    });
    logIngestResult(result);

    // The contract passes question answers through because at a server boundary `incoming` IS
    // `response.data`. Here it is only the host's bag, so a key naming a question is not an answer —
    // and keeping it would be worse than useless: `ResponseQueue` merges this record OVER `data` on
    // every submit, so a hidden field named after a question id would re-apply its display-time
    // value on top of whatever the respondent actually answered. Prefilling has its own prop.
    const elementIdSet = new Set(elementIds);
    return Object.fromEntries(
      Object.entries(result.data).filter(([key]) => {
        if (!elementIdSet.has(key)) return true;
        console.warn(
          `Formbricks: "${key}" ${INGEST_DROP_MESSAGES.element_id_collision}, so the value was ignored.`
        );
        return false;
      })
    );
  });

  /**
   * How the survey starts (ENG-6932): the rules before the first question run once, as soon as the
   * survey loads — before the welcome card, and on start-at links too. They read what the survey
   * loaded with (the ingested hidden fields and URL parameters, the seeded computed fields and the
   * reserved fields this browser knows), so this lives in a lazy initialiser like the ingest record
   * above: the decision belongs to the display, and later renders must not re-run it.
   */
  const [startOutcome] = useState(() => {
    const elementIds = getElementsFromSurveyBlocks(survey.blocks).map((element) => element.id);
    const variables = seedComputedVariables(survey.embeddedFields);
    const reservedFieldValues = projectClientReservedValues(
      dropShadowedReservedEntries(
        RESERVED_FIELD_CATALOG,
        listShadowingNames(getSurveyEmbeddedFields(survey), elementIds)
      ),
      {
        surveyId: survey.id,
        language: languageCode === "default" ? (getDefaultLanguageCode(survey) ?? null) : languageCode,
        data: ingestedFieldsRecord,
        variables,
        ttc: {},
        meta: { ...webSurveyMetaRef.current?.(), action },
      }
    );
    // A start-at link skips the welcome card; an unknown question id opens the first block, as before.
    const startAtBlockId = startAtQuestionId
      ? (findBlockByElementId(survey.blocks, startAtQuestionId)?.id ?? survey.blocks[0]?.id)
      : undefined;

    return startSurvey({
      survey,
      startAtBlockId,
      responseData: ingestedFieldsRecord,
      variables,
      selectedLanguage: languageCode,
      reservedFieldValues,
    });
  });
  const [currentVariables, setCurrentVariables] = useState<TResponseVariables>(startOutcome.variables);

  const isLinkSurvey = survey.type === "link";
  const offlinePersistEnabled = offlineSupport && isLinkSurvey && !isPreviewMode && !!appUrl && !!workspaceId;

  const persistSurveyStateSnapshot = useCallback(
    async (snapshotPatch: Partial<SerializedSurveyState>) => {
      if (!offlinePersistEnabled) return;
      await patchSurveyProgressSnapshot(survey.id, snapshotPatch);
    },
    [offlinePersistEnabled, survey.id]
  );

  // `onResponseCreateOrUpdate` runs on every question submit, but a response is only *created* on the
  // first submit — later submits update it. `onResponseCreated` must therefore fire once, not per
  // question, otherwise a 5-question survey triggers 5 downstream `/user` refreshes in js-core.
  //
  // Fired from the queue's server-ack seam below (not at enqueue time) so it can carry the persisted
  // `responseId` — the id is minted by the server, so an event that carries it can only fire after
  // the ack (ENG-1846). Same post-ack semantics as `onDisplayCreated`, which fires after
  // createDisplay. Preview mode never reaches the queue and fires this without an id at submit time.
  const responseCreatedRef = useRef(false);
  const triggerResponseCreatedOnce = useCallback(
    (responseId?: string) => {
      if (responseCreatedRef.current) return;
      responseCreatedRef.current = true;
      void onResponseCreated?.(responseId);
    },
    [onResponseCreated]
  );

  // One per mounted display, so the queue shared by this display's ResponseQueue instances is not the
  // one an earlier display of the same survey left behind.
  const displayKeyRef = useRef<string | null>(null);
  displayKeyRef.current ??= String(++displayCounter);

  const responseQueue = useMemo(() => {
    if (appUrl && workspaceId && surveyState) {
      return new ResponseQueue(
        {
          appUrl,
          workspaceId,
          retryAttempts: 4,
          persistOffline: offlinePersistEnabled,
          surveyId: survey.id,
          displayKey: displayKeyRef.current ?? undefined,
          onResponseSendingFailed: (_, errorCode?: TResponseErrorCodesEnum) => {
            setShowError(true);
            setErrorType(errorCode);

            if (getSetIsError) {
              getSetIsError((_prev) => {});
            }
          },
          onResponseSendingFinished: () => {
            setIsResponseSendingFinished(true);
            setShowError(false);
            setErrorType(undefined);

            if (getSetIsResponseSendingFinished) {
              getSetIsResponseSendingFinished((_prev) => {});
            }
          },
          onQuotaFull: (quotaInfo) => {
            if (quotaInfo.action === "endSurvey") {
              setIsResponseSendingFinished(true);
              setIsSurveyFinished(true);
              setBlockId(quotaInfo.endingCardId);
            }
          },
          onResponseCreated: (responseId) => {
            void persistSurveyStateSnapshot({ responseId });
            try {
              triggerResponseCreatedOnce(responseId);
            } catch (error) {
              // This runs inside ResponseQueue.sendResponse's try block, and the callback reaches
              // host-supplied code (js-core's event bus → the host page). A throw here would be
              // caught as a SEND failure — the respondent shown an error and a retry for a response
              // the server already created. Never let a host page do that.
              console.error("Formbricks: onResponseCreated handler threw", error);
            }
          },
        },
        surveyState
      );
    }

    return null;
  }, [
    appUrl,
    workspaceId,
    getSetIsError,
    getSetIsResponseSendingFinished,
    surveyState,
    offlinePersistEnabled,
    persistSurveyStateSnapshot,
    triggerResponseCreatedOnce,
    survey.id,
  ]);

  const questions = useMemo(() => getElementsFromSurveyBlocks(localSurvey.blocks), [localSurvey.blocks]);

  const originalQuestionRequiredStates = useMemo(() => {
    return questions.reduce<Record<string, boolean>>((acc, question) => {
      acc[question.id] = question.required;
      return acc;
    }, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only recompute when blocks structure changes
  }, [survey.blocks]);

  // state to keep track of the questions that were made required by each specific question's logic
  const questionRequiredByMap = useRef<Record<string, string[]>>({});

  // Update localSurvey when the survey prop changes (it changes in case of survey editor)
  useEffect(() => {
    setlocalSurvey(survey);
  }, [survey]);

  // ENG-1837: computed fields are seeded from their definitions in the EmbeddedData tables. The
  // first seed is `startOutcome`'s, with what the rules before the first question set on top
  // (ENG-6932); this re-seeds only when the definitions change afterwards (the editor's preview).
  const seededEmbeddedFieldsRef = useRef(survey.embeddedFields);
  useEffect(() => {
    if (survey.embeddedFields === seededEmbeddedFieldsRef.current) return;
    seededEmbeddedFieldsRef.current = survey.embeddedFields;
    setCurrentVariables(seedComputedVariables(survey.embeddedFields));
  }, [survey.embeddedFields]);

  const autoFocusEnabled = autoFocus ?? window.self === window.top;

  // Block-based navigation: track current block ID instead of question ID
  // The welcome card, a start-at block, or wherever the rules before the first question sent the
  // respondent — an ending for a screen-out (see `startOutcome`).
  const [blockId, setBlockId] = useState(() => startOutcome.firstCardId);

  // True once the user navigated between cards (Next/Back/auto-progress). Moving focus into
  // the new card is then a response to a user action (safe under WCAG 3.2.x), unlike the
  // initial render of an embedded survey, where stealing focus from the host page is not.
  const hasUserNavigatedRef = useRef(false);

  const [errorType, setErrorType] = useState<TResponseErrorCodesEnum | undefined>(undefined);
  const [showError, setShowError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isResponseSendingFinished, setIsResponseSendingFinished] = useState(
    !getSetIsResponseSendingFinished
  );
  const [isSurveyFinished, setIsSurveyFinished] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(languageCode);
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  // The block the survey opened on after passing over blocks hidden by show-if (ENG-6931). Nothing
  // precedes it, so it shows no Back button, like the first block.
  const [entryBlockId, setEntryBlockId] = useState<string | undefined>(undefined);
  /**
   * What the survey kept from the respondent, one step per submitted card, next to `history` (ENG-6936).
   * The record every update sends is folded from them; see `not-shown-record.ts`. The entry step holds
   * the blocks passed over when the survey opened straight onto a block.
   */
  const [notShownSteps, setNotShownSteps] = useState<TNotShownStep[]>([]);
  const [entryNotShownStep, setEntryNotShownStep] = useState<TNotShownStep | null>(null);
  const isNavigatingBackRef = useRef(false);
  const [responseData, setResponseData] = useState<TResponseData>(ingestedFieldsRecord);
  const [_variableStack, setVariableStack] = useState<VariableStackEntry[]>([]);

  const [ttc, setTtc] = useState<TResponseTtc>({});
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [progressRestored, setProgressRestored] = useState(!offlinePersistEnabled);

  // Notify parent of offline status changes (for rendering alert in the React layer)
  useEffect(() => {
    onOfflineStatusChange?.({ isOnline, isSyncing, pendingSyncCount });
  }, [isOnline, isSyncing, pendingSyncCount, onOfflineStatusChange]);

  const cardArrangement = useMemo(() => {
    if (localSurvey.type === "link") {
      return styling.cardArrangement?.linkSurveys ?? "straight";
    }
    return styling.cardArrangement?.appSurveys ?? "straight";
  }, [localSurvey.type, styling.cardArrangement?.linkSurveys, styling.cardArrangement?.appSurveys]);
  const isCardless = cardArrangement === "cardless";
  const linkSurveyCardMaxWidth =
    localSurvey.type === "link" ? getLinkSurveyCardMaxWidth(styling.linkSurveyCardWidth) : undefined;

  // Current block tracking (replaces currentQuestionIndex)
  const currentBlockIndex = localSurvey.blocks.findIndex((b) => b.id === blockId);
  const currentBlock = localSurvey.blocks[currentBlockIndex];

  const contentRef = useRef<HTMLDivElement | null>(null);
  const showProgressBar = !styling.hideProgressBar;
  const getShowSurveyCloseButton = (offset: number) => {
    return offset === 0 && localSurvey.type !== "link";
  };
  const enabledLanguages = localSurvey.languages.filter((lang) => lang.enabled);
  const getShowLanguageSwitch = (offset: number) => {
    return localSurvey.showLanguageSwitch && enabledLanguages.length > 1 && offset <= 0;
  };

  const onFileUpload = async (file: TJsFileUploadParams["file"], params?: TUploadFileConfig) => {
    if (isPreviewMode) {
      // return mock url since an url is required for the preview
      return `https://example.com/${file.name}`;
    }

    if (!apiClient) {
      throw new Error("apiClient not initialized");
    }

    const response = await apiClient.uploadFile(
      {
        type: file.type,
        name: file.name,
        base64: file.base64,
      },
      {
        ...params,
        pinAuthToken: surveyState?.pinAuthToken,
        singleUseId: surveyState?.singleUseId,
        url: getWebSurveyMeta().url,
      }
    );

    return response;
  };

  useEffect(() => {
    // scroll to top when block changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [blockId]);

  const createDisplay = useCallback(async () => {
    // Skip display creation in preview mode but still trigger the onDisplayCreated callback
    if (isPreviewMode) {
      // Fire and forget, as before: a preview has no display to wait for.
      void onDisplayCreated?.();
      void onDisplay?.();
      return;
    }

    if (apiClient && surveyState && responseQueue) {
      try {
        const display = await apiClient.createDisplay({
          surveyId: survey.id,
          ...(userId && { userId }),
          ...(contactId && { contactId }),
          ...(creativeId && { creativeId }),
        });

        if (!display.ok) {
          // @ts-expect-error -- display.error is of type ApiErrorResponse
          throw new Error(display.error);
        }

        surveyState.updateDisplayId(display.data.id);
        responseQueue.updateSurveyState(surveyState);
        await persistSurveyStateSnapshot({ displayId: display.data.id });

        if (onDisplayCreated) {
          onDisplayCreated();
        }
      } catch (err) {
        console.error("error creating display: ", err);
      }
    }
  }, [
    apiClient,
    surveyState,
    responseQueue,
    survey.id,
    userId,
    contactId,
    creativeId,
    onDisplayCreated,
    isPreviewMode,
    onDisplay,
    persistSurveyStateSnapshot,
  ]);

  // Create display on mount. When offline persistence is enabled, wait for progress
  // restoration so we can skip creating a new display if a session was restored.
  const displayCreatedRef = useRef(false);
  // Set once the display exists (or never will, outside a real deployment), so a screen-out before
  // the first question creates its response against that display (ENG-6932).
  const [isDisplaySettled, setIsDisplaySettled] = useState(false);
  // A screen-out is sent at most once, and never for a session resumed from offline progress.
  const screenOutHandledRef = useRef(false);
  // A rule marked the response Low quality (ENG-6933). The next response write carries
  // `markLowQuality: true`, once: sent again on every later write, it would undo a reviewer's restore
  // made while the respondent is still answering.
  const pendingLowQualityRef = useRef(false);

  useEffect(() => {
    if (offlinePersistEnabled && !progressRestored) return;

    // If we restored a session that already has a displayId, skip creating a new one.
    if (offlinePersistEnabled && surveyState?.displayId) {
      displayCreatedRef.current = true;
      return;
    }

    if (displayCreatedRef.current) return;
    displayCreatedRef.current = true;

    if (appUrl && workspaceId) {
      void createDisplay().finally(() => setIsDisplaySettled(true));
    } else {
      onDisplay?.();
      setIsDisplaySettled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, or once after restore for offline
  }, [progressRestored]);

  useEffect(() => {
    if (getSetIsError) {
      getSetIsError((value: boolean) => {
        setShowError(value);
      });
    }
  }, [getSetIsError]);

  useEffect(() => {
    if (getSetBlockId) {
      getSetBlockId((value: string) => {
        setBlockId(value);
      });
    }
  }, [getSetBlockId]);

  useEffect(() => {
    if (getSetResponseData) {
      getSetResponseData((value: TResponseData) => {
        setResponseData(value);
      });
    }
  }, [getSetResponseData]);

  useEffect(() => {
    if (getSetIsResponseSendingFinished) {
      getSetIsResponseSendingFinished((value: boolean) => {
        setIsResponseSendingFinished(value);
      });
    }
  }, [getSetIsResponseSendingFinished]);

  useEffect(() => {
    setSelectedLanguage(languageCode);
  }, [languageCode]);

  // Report the active language (initial value + every switch) so a link-survey
  // host can keep the page lang/dir in sync (WCAG 3.1.1). Embedded widgets pass
  // no callback, so the host page is never touched.
  useEffect(() => {
    onLanguageChange?.(selectedLanguage);
  }, [selectedLanguage, onLanguageChange]);

  // Report the respondent's position (initial card + every navigation) so a link-survey host can
  // title the document per step (WCAG 2.4.2). The label is localized HERE rather than by the host:
  // the survey knows its own active language, while the host's i18n is in the viewer's UI locale,
  // so a title assembled there would mix the two. Embedded widgets pass no callback.
  useEffect(() => {
    if (!onPageChange) return;
    const { index, total } = getSurveyPagePosition(localSurvey, blockId);
    onPageChange({
      index,
      total,
      label: t("common.page_x_of_y", { current: index, total }),
    });
  }, [blockId, localSurvey, onPageChange, t]);

  // --- Offline support: restore progress from IndexedDB on mount ---
  useEffect(() => {
    if (!offlinePersistEnabled) return;

    let cancelled = false;

    const restore = async () => {
      const progress = await getSurveyProgress(survey.id);

      if (cancelled || !progress) {
        setProgressRestored(true);
        return;
      }

      // Discard stale progress (older than 24 hours)
      const MAX_AGE_MS = 24 * 60 * 60 * 1000;
      if (Date.now() - progress.updatedAt > MAX_AGE_MS) {
        await clearSurveyProgress(survey.id);
        setProgressRestored(true);
        return;
      }

      // Check pending responses first — this determines whether the survey is truly complete.
      const pendingCount = responseQueue ? await responseQueue.loadPersistedQueue() : 0;

      // If the survey is fully complete (no pending responses + finished), discard stale
      // progress and start fresh instead of restoring to the ending card.
      if (pendingCount === 0) {
        // The "end" sentinel counts as an ending card here: a survey with no endings defined
        // finishes on it, so restoring onto it would resume a session that is already over.
        const isEndingCard = isFinishedBlockId(localSurvey, progress.blockId);
        const isResponseFinished = progress.surveyStateSnapshot?.responseAcc?.finished === true;

        if (isEndingCard || isResponseFinished) {
          await clearSurveyProgress(survey.id);
          setProgressRestored(true);
          return;
        }
      }

      if (pendingCount > 0) {
        setPendingSyncCount(pendingCount);
      }

      /*
       * Reinstate the browser context this response was first displayed with. Past this point the
       * entry is being resumed, so the writes that follow go to the response `surveyStateSnapshot`
       * already identifies — and the meta they carry has to keep describing the original display.
       * Lazy `useRef` init has already measured the *current* page by now (a reload can land on a
       * different URL, referrer or viewport), so the persisted snapshot replaces it rather than
       * merging with it: a partial merge would report a context that never existed.
       *
       * Entries written before this field existed carry no meta and keep the freshly measured
       * snapshot, which is exactly the behaviour they had.
       */
      if (progress.webSurveyMeta) {
        const restoredMeta = progress.webSurveyMeta;
        webSurveyMetaRef.current = () => restoredMeta;
      }

      // Validate that the saved blockId still exists in the current survey
      const blockExists =
        progress.blockId === "start" ||
        progress.blockId === "end" ||
        localSurvey.blocks.some((b) => b.id === progress.blockId) ||
        localSurvey.endings.some((e) => e.id === progress.blockId);

      if (blockExists) {
        // Resuming where the respondent was: the rules before the first question already let them in.
        screenOutHandledRef.current = true;
        setBlockId(progress.blockId);
        setResponseData(progress.responseData);
        setTtc(progress.ttc);
        setCurrentVariables(progress.currentVariables);
        setHistory(getRestorableHistory(localSurvey, progress.history));
        setNotShownSteps(progress.notShownSteps ?? []);
        setSelectedLanguage(progress.selectedLanguage);

        // Restore survey state from snapshot
        if (surveyState && progress.surveyStateSnapshot) {
          restoreSurveyStateFromSnapshot(surveyState, progress.surveyStateSnapshot, progress);

          if (pendingCount === 0 && !progress.surveyStateSnapshot.responseId) {
            if (progress.surveyStateSnapshot.displayId && apiClient) {
              const responseLookup = await apiClient.getResponseIdByDisplayId(
                progress.surveyStateSnapshot.displayId
              );

              if (responseLookup.ok && responseLookup.data.responseId) {
                surveyState.updateResponseId(responseLookup.data.responseId);
                await persistSurveyStateSnapshot({ responseId: responseLookup.data.responseId });
              } else if (responseLookup.ok) {
                surveyState.enableBootstrapResponseCreate();
              } else if (responseLookup.error.status === 404) {
                surveyState.updateDisplayId(null);
                surveyState.enableBootstrapResponseCreate();
                await persistSurveyStateSnapshot({ displayId: null });
              } else {
                console.error("Formbricks: Failed to recover responseId from displayId", {
                  displayId: progress.surveyStateSnapshot.displayId,
                  error: responseLookup.error,
                });
                surveyState.enableBootstrapResponseCreate();
              }
            } else {
              surveyState.enableBootstrapResponseCreate();
            }
          }

          responseQueue?.updateSurveyState(surveyState);
        }
      } else {
        // Block no longer exists (survey structure changed) — discard UI progress
        // but still restore survey state and sync pending responses below.
        await clearSurveyProgress(survey.id);

        if (surveyState && progress.surveyStateSnapshot) {
          restoreSurveyStateFromSnapshot(surveyState, progress.surveyStateSnapshot, progress);
          responseQueue?.updateSurveyState(surveyState);
        }
      }

      setProgressRestored(true);
    };

    void restore();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- should only run on mount
  }, []);

  // --- Offline support: save progress to IndexedDB on submit (see onSubmit) ---

  // --- Offline support: sync pending responses when coming back online ---
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!offlinePersistEnabled || !responseQueue || !progressRestored) return;

    // Reset the guard when going offline so a new sync can start next time we're online
    if (!isOnline) {
      isSyncingRef.current = false;
      return;
    }

    // Prevent duplicate syncs from re-renders while a sync is already in progress
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    const syncPending = async () => {
      try {
        const count = await responseQueue.getPendingCount();
        if (count === 0) return;

        setIsSyncing(true);
        setPendingSyncCount(count);

        const result = await responseQueue.syncPersistedResponses((synced, total) => {
          setPendingSyncCount(total - synced);
        });

        setIsSyncing(false);
        setPendingSyncCount(0);

        if (result.syncedCount > 0) {
          console.log(`Formbricks: Synced ${result.syncedCount} offline response(s)`);
        }

        // Clean up IndexedDB and mark sending as finished after successful sync
        // Individual entries are already removed from IndexedDB inside syncPersistedResponses.
        // Don't use clearPendingResponses here — it would wipe entries added during the async sync.
        if (result.success) {
          await clearSurveyProgress(survey.id);

          if (result.syncedCount > 0) {
            setIsResponseSendingFinished(true);
          }
        }
      } finally {
        isSyncingRef.current = false;
      }
    };

    void syncPending();
  }, [isOnline, offlinePersistEnabled, responseQueue, progressRestored, survey.id]);

  // --- Warn before leaving mid-survey or with unsent offline responses ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Warn if user has started answering but hasn't finished the survey (only when offline support is active)
      if (offlinePersistEnabled && history.length > 0 && !isSurveyFinished) {
        e.preventDefault();
        return;
      }
      // Warn if there are unsent offline responses
      if (
        offlinePersistEnabled &&
        responseQueue &&
        (responseQueue.queue.length > 0 || pendingSyncCount > 0)
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [history.length, isSurveyFinished, offlinePersistEnabled, responseQueue, pendingSyncCount]);

  // Merges into the latest answers, not this render's copy: a file upload calls this when it
  // finishes, seconds after the render it started in, and other answers may have changed since.
  const onChange = (responseDataUpdate: TResponseData) => {
    setResponseData((prev) => ({ ...prev, ...responseDataUpdate }));
  };

  const onChangeVariables = (variables: TResponseVariables) => {
    const updatedVariables = { ...currentVariables, ...variables };
    setCurrentVariables(updatedVariables);
  };

  const makeQuestionsRequired = (requiredQuestionIds: string[]): void => {
    const updateElementIfRequired = (element: TSurveyElement) => {
      if (requiredQuestionIds.includes(element.id)) {
        return { ...element, required: true };
      }
      return element;
    };

    const updateBlockElements = (block: TSurveyBlock) => ({
      ...block,
      elements: block.elements.map(updateElementIfRequired),
    });

    setlocalSurvey((prevSurvey) => ({
      ...prevSurvey,
      blocks: prevSurvey.blocks.map(updateBlockElements),
    }));
  };

  const revertRequiredChangesByQuestion = (questionId: string): void => {
    const questionsToRevert = questionRequiredByMap.current[questionId] || [];

    if (questionsToRevert.length > 0) {
      const revertElementIfNeeded = (element: TSurveyElement) => {
        if (questionsToRevert.includes(element.id)) {
          return {
            ...element,
            required: originalQuestionRequiredStates[element.id] ?? element.required,
          };
        }
        return element;
      };

      const updateBlockElements = (block: TSurveyBlock) => ({
        ...block,
        elements: block.elements.map(revertElementIfNeeded),
      });

      setlocalSurvey((prevSurvey) => ({
        ...prevSurvey,
        blocks: prevSurvey.blocks.map(updateBlockElements),
      }));

      // remove the question from the map
      delete questionRequiredByMap.current[questionId];
    }
  };

  const pushVariableState = (currentQuestionId: string) => {
    setVariableStack((prevStack) => [
      ...prevStack,
      { questionId: currentQuestionId, variables: { ...currentVariables } },
    ]);
  };

  const popVariableState = () => {
    setVariableStack((prevStack) => {
      const newStack = [...prevStack];
      const poppedState = newStack.pop();
      if (poppedState) {
        setCurrentVariables(poppedState.variables);
      }
      return newStack;
    });
  };

  const getWebSurveyMeta = useCallback((): TWebSurveyMeta => webSurveyMetaRef.current?.() ?? {}, []);

  const onResponseCreateOrUpdate = useCallback(
    async (responseUpdate: TResponseUpdate) => {
      // Always trigger the onResponse callback even in preview mode
      if (!appUrl || !workspaceId) {
        onResponse?.({
          data: responseUpdate.data,
          ttc: responseUpdate.ttc,
          finished: responseUpdate.finished,
          variables: responseUpdate.variables,
          language: responseUpdate.language,
          endingId: responseUpdate.endingId,
        });
        return;
      }

      // Skip response creation in preview mode but still trigger the onResponseCreated callback (once)
      if (isPreviewMode) {
        triggerResponseCreatedOnce();

        // When in preview mode, set isResponseSendingFinished to true if the response is finished
        if (responseUpdate.finished) {
          setIsResponseSendingFinished(true);
        }
        return;
      }

      if (surveyState && responseQueue) {
        if (contactId) {
          surveyState.updateContactId(contactId);
        }

        if (userId) {
          surveyState.updateUserId(userId);
        }

        responseQueue.updateSurveyState(surveyState);
        const markLowQuality = pendingLowQualityRef.current;
        pendingLowQualityRef.current = false;
        responseQueue.add({
          ...(markLowQuality && { markLowQuality: true }),
          data: responseUpdate.data,
          ttc: responseUpdate.ttc,
          finished: responseUpdate.finished,
          language:
            responseUpdate.language === "default" ? getDefaultLanguageCode(survey) : responseUpdate.language,
          meta: {
            ...getWebSurveyMeta(),
            action,
            // Meta is written on create only, so the id rides on every write to be on the first.
            ...(creativeId && { openedByCreativeId: creativeId }),
          },
          variables: responseUpdate.variables,
          displayId: surveyState.displayId,
          endingId: responseUpdate.endingId,
          notShown: responseUpdate.notShown,
          // The filtered record, not the raw prop: `ResponseQueue` merges `hiddenFields` over `data`
          // on every submit, so sending the raw bag here would put the dropped and uncoerced values
          // straight back.
          hiddenFields: ingestedFieldsRecord,
        });
        // No trigger here: the queue's onResponseCreated ack fires it with the persisted responseId.
      }
    },
    [
      appUrl,
      workspaceId,
      isPreviewMode,
      surveyState,
      responseQueue,
      onResponse,
      triggerResponseCreatedOnce,
      contactId,
      userId,
      survey,
      action,
      creativeId,
      ingestedFieldsRecord,
      getWebSurveyMeta,
    ]
  );

  /**
   * The catalog entries this survey may resolve at all — everything the survey does not declare
   * itself (ENG-2538).
   *
   * Without this filter the projection below carried a reserved value for every name in the catalog,
   * and {@link mergeReservedValues}'s spread was the only thing keeping a declared field ahead of
   * it. A spread only wins for keys that exist, so a survey declaring an optional `url` rendered the
   * page's own address — an internal `/edit` URL in the editor's preview, the respondent's own link
   * in production — wherever the respondent had not supplied the field. That is the normal case for
   * a hidden field, and it reached respondent-facing copy.
   *
   * Element ids count as declarations here, which is why `questions` is in the list: a question with
   * id `url` is absent from `responseData` until it is answered, so the reserved read would win for
   * exactly as long as the respondent had not reached it.
   */
  const readableReservedEntries = useMemo(
    () =>
      dropShadowedReservedEntries(
        RESERVED_FIELD_CATALOG,
        listShadowingNames(
          getSurveyEmbeddedFields(localSurvey),
          questions.map((question) => question.id)
        )
      ),
    [localSurvey, questions]
  );

  /**
   * Reserved-field values this renderer can resolve *right now* (ENG-1840).
   *
   * `projectClientReservedValues` drops every `server` catalog entry, so the map holds only what a
   * browser mid-survey actually knows (url, source, action, language today; the SDK-captured entries
   * light up automatically once they land in the catalog). A recall token or logic operand naming a
   * server-derived field — country, durationSeconds, browser — finds no key and reads as unset,
   * which is the correct answer rather than a fabricated empty string.
   *
   * The meta slice is the same expression the response queue persists, so what recall shows and what
   * ingest stores cannot drift apart. `language` is resolved the same way too: `"default"` is a
   * renderer-internal sentinel, and `#recall:language#` must render the real language code.
   */
  const reservedValues = useMemo(
    () =>
      projectClientReservedValues(readableReservedEntries, {
        surveyId: localSurvey.id,
        language:
          selectedLanguage === "default" ? (getDefaultLanguageCode(survey) ?? null) : selectedLanguage,
        data: responseData,
        variables: currentVariables,
        ttc,
        meta: { ...getWebSurveyMeta(), action },
      }),
    [
      readableReservedEntries,
      localSurvey.id,
      selectedLanguage,
      survey,
      responseData,
      currentVariables,
      ttc,
      getWebSurveyMeta,
      action,
    ]
  );

  /**
   * Recall's lookup map. The reserved side is already shadow-filtered, so a declared field owns its
   * name whether or not it has a value; the merge order is what still protects a stored `""` or `0`.
   *
   * Ingested defaults go underneath both, because they are the answer of last resort: a field the
   * respondent supplied nothing usable for falls back to what the survey declared. They are kept out
   * of `responseData` on purpose — that record is what the queue submits, and ingest does not write
   * defaults (see `projectIngestedDefaults`).
   */
  const recallValues = useMemo(
    () => buildEmbeddedLookup(localSurvey, reservedValues, responseData),
    [localSurvey, reservedValues, responseData]
  );

  /**
   * Show-if (ENG-6931): a survey that opens straight onto a block (no welcome card, or a start-at
   * link) passes over it when it is not shown, running its logic, exactly as the welcome card's
   * Next does. Values it sets travel with the first page's submit; when every block is passed over,
   * the survey finishes on the ending at once.
   */
  const entryCheckedRef = useRef(false);
  useEffect(() => {
    if (entryCheckedRef.current) return;
    entryCheckedRef.current = true;
    if (!localSurvey.blocks.some((block) => block.id === blockId)) return;

    const entry = enterBlock({
      survey: localSurvey,
      blockId,
      responseData,
      variables: currentVariables,
      selectedLanguage,
      reservedFieldValues: reservedValues,
    });
    if (entry.skippedBlockIds.length === 0) return;

    const entryStep: TNotShownStep = {
      blockId: "",
      hiddenElementIds: [],
      skippedBlockIds: entry.skippedBlockIds,
    };
    setEntryNotShownStep(entryStep);
    setCurrentVariables(entry.variables);
    if (entry.requiredQuestionIds.length > 0) makeQuestionsRequired(entry.requiredQuestionIds);
    // Travels with the first write, like the values the passed-over blocks set.
    if (entry.markLowQuality) pendingLowQualityRef.current = true;
    if (entry.finished) {
      setIsSurveyFinished(true);
      onResponseCreateOrUpdate({
        data: {},
        ttc: {},
        finished: true,
        variables: entry.variables,
        language: selectedLanguage,
        endingId: entry.endingId,
        notShown: buildNotShownRecord(localSurvey, [entryStep]),
      });
    }
    setEntryBlockId(entry.nextCardId);
    setBlockId(entry.nextCardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the card the survey opened on
  }, []);

  useEffect(() => {
    if (isPreviewMode || !survey.recaptcha?.enabled) return;

    if (!isSpamProtectionEnabled) {
      setShowError(true);
      setErrorType(TResponseErrorCodesEnum.InvalidDeviceError);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps -- this is a one-time effect
  }, []);

  // When offline with persistence, the response is safely stored in IndexedDB.
  // Mark it as "sending finished" for the UI (ending card) without triggering cleanup.
  useEffect(() => {
    if (offlinePersistEnabled && !isOnline && isSurveyFinished && !isResponseSendingFinished) {
      setIsResponseSendingFinished(true);
    }
  }, [offlinePersistEnabled, isOnline, isSurveyFinished, isResponseSendingFinished]);

  useEffect(() => {
    if (isResponseSendingFinished && isSurveyFinished) {
      // Post a message to the parent window indicating that the survey is completed.
      window.parent.postMessage("formbricksSurveyCompleted", "*"); // NOSONAR typescript:S2819 // We can't check the targetOrigin here because we don't know the parent window's origin.
      // Gated on isResponseSendingFinished, so outside preview/offline the ack has landed and the
      // queue has stamped the persisted responseId onto surveyState (ENG-1846).
      onFinished?.(surveyState?.responseId ?? undefined);
    }
  }, [isResponseSendingFinished, isSurveyFinished, onFinished]);

  /**
   * A screen-out before the first question (ENG-6932, T17): the rules sent the respondent to an
   * ending as the survey loaded, so the ending is already on screen. The survey creates the finished
   * response at once, through the create endpoint every first submit uses: the ending, the hidden
   * fields and URL parameters (the queue merges them into `data`) and the values the rules set. With
   * spam protection on, it fetches a reCAPTCHA token first, as the first submit does.
   */
  useEffect(() => {
    if (!isDisplaySettled || !startOutcome.finished || screenOutHandledRef.current) return;
    screenOutHandledRef.current = true;

    const submitScreenOut = async () => {
      if (isSpamProtectionEnabled && !surveyState?.responseId && getRecaptchaToken) {
        const token = await getRecaptchaToken();
        if (responseQueue && token) {
          responseQueue.setResponseRecaptchaToken(token);
        } else {
          setShowError(true);
          setErrorType(TResponseErrorCodesEnum.RecaptchaError);
          return;
        }
      }

      setIsSurveyFinished(true);
      await onResponseCreateOrUpdate({
        data: {},
        ttc: {},
        finished: true,
        variables: startOutcome.variables,
        language: selectedLanguage,
        endingId: startOutcome.endingId,
      });
    };

    void submitScreenOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the display has settled
  }, [isDisplaySettled]);

  // The outgoing card stays visible while the card transition cross-fades, so a
  // control that kept focus would show its focus ring hanging mid-fade before
  // vanishing with the card. Drop focus when navigation starts; the incoming
  // card focuses its first control on mount.
  const blurOutgoingCard = (): void => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  };

  const onSubmit = async (surveyResponseData: TResponseData, responsettc: TResponseTtc) => {
    // The survey is already over — an ending card or the "end" sentinel is showing. Re-sending the
    // response would repeat `finished: true`, which the server rejects with a 400, and the error card
    // would then replace the ending. Nothing is left to record, so the submit is a no-op; returning
    // here also keeps the ending id out of `history`.
    if (isFinishedBlockId(localSurvey, blockId)) return;

    isNavigatingBackRef.current = false;
    hasUserNavigatedRef.current = true;
    blurOutgoingCard();

    // Get the first responded element ID for tracking
    const respondedElementIds = Object.keys(surveyResponseData);
    const firstRespondedElementId = respondedElementIds[0];

    setLoadingElement(true);

    if (isSpamProtectionEnabled && !surveyState?.responseId && getRecaptchaToken) {
      const token = await getRecaptchaToken();
      if (responseQueue && token) {
        responseQueue.setResponseRecaptchaToken(token);
      } else {
        setShowError(true);
        setErrorType(TResponseErrorCodesEnum.RecaptchaError);
        setLoadingElement(false);
        return;
      }
    }

    pushVariableState(firstRespondedElementId);

    const {
      nextCardId,
      finished,
      endingId,
      variables: calculatedVariables,
      requiredQuestionIds,
      submittedData,
      hiddenElementIds,
      optionsNotShown,
      markLowQuality,
      skippedBlockIds,
    } = advanceFromBlock({
      survey: localSurvey,
      blockId,
      responseData,
      submittedData: surveyResponseData,
      variables: currentVariables,
      selectedLanguage,
      reservedFieldValues: reservedValues,
      startBlockId: startOutcome.startBlockId,
    });

    if (requiredQuestionIds.length > 0) {
      if (currentBlock?.elements[0]) {
        questionRequiredByMap.current[currentBlock.elements[0].id] = requiredQuestionIds;
      }
      makeQuestionsRequired(requiredQuestionIds);
    }

    setIsSurveyFinished(finished);

    // The not-shown record after this submit (ENG-6936): the steps of the cards still on the path,
    // then this one. Sent whole with the update; the server replaces the stored record with it.
    const nextNotShownSteps = appendNotShownStep(notShownSteps, history.length, {
      blockId,
      hiddenElementIds,
      skippedBlockIds,
      optionsNotShown,
    });
    setNotShownSteps(nextNotShownSteps);
    const notShown = buildNotShownRecord(
      localSurvey,
      entryNotShownStep ? [entryNotShownStep, ...nextNotShownSteps] : nextNotShownSteps
    );
    const notShownElementIds = getNotShownElementIds(notShown, localSurvey.blocks);

    // An answer typed into a question that show-if hid before the submit is dropped, not submitted
    // (ENG-6931), and so is an earlier answer to anything the record now lists, after Back or a changed
    // answer (ENG-6936): from the answers later conditions and recall read. The server removes it from
    // the response.
    setResponseData((prev) => {
      const next = { ...prev, ...submittedData };
      for (const elementId of hiddenElementIds) delete next[elementId];
      for (const elementId of notShownElementIds) delete next[elementId];
      return next;
    });
    onChangeVariables(calculatedVariables);

    // A rule marked the response Low quality (ENG-6933): this submit's write carries the flag. The
    // respondent sees nothing.
    if (markLowQuality) pendingLowQualityRef.current = true;

    onResponseCreateOrUpdate({
      data: submittedData,
      ttc: responsettc,
      finished,
      variables: calculatedVariables,
      language: selectedLanguage,
      endingId,
      notShown,
    });

    setBlockId(nextCardId);
    // add current block to history
    const newHistory = [...history, blockId];
    setHistory(newHistory);

    // --- Offline support: save progress on each submit ---
    if (offlinePersistEnabled) {
      void saveSurveyProgress({
        surveyId: survey.id,
        blockId: nextCardId,
        responseData: { ...responseData, ...submittedData },
        ttc: { ...ttc, ...responsettc },
        currentVariables: calculatedVariables,
        history: newHistory,
        notShownSteps: nextNotShownSteps,
        selectedLanguage,
        webSurveyMeta: getWebSurveyMeta(),
        surveyStateSnapshot: {
          responseId: surveyState?.responseId ?? null,
          displayId: surveyState?.displayId ?? null,
          surveyId: survey.id,
          singleUseId: surveyState?.singleUseId ?? null,
          userId: surveyState?.userId ?? null,
          contactId: surveyState?.contactId ?? null,
          responseAcc: surveyState?.responseAcc ?? { finished: false, data: {}, ttc: {}, variables: {} },
        },
        updatedAt: Date.now(),
      });
    }

    setLoadingElement(false);
  };

  const onBack = (): void => {
    const prevBlockId = getPreviousBlockId(localSurvey, blockId, history);

    // Nothing precedes the current card — the respondent is on the first block, or `blockId` is an
    // ending / a block that no longer exists and no history was saved. Back is a no-op rather than
    // a throw (ENG-2818), and nothing is consumed: neither the history nor the variable stack is
    // popped for a navigation that does not happen.
    if (!prevBlockId) return;

    isNavigatingBackRef.current = true;
    hasUserNavigatedRef.current = true;
    blurOutgoingCard();

    if (history.length > 0) {
      setHistory(history.slice(0, -1));
    }
    popVariableState();

    // Revert required changes by the first element in the previous block
    const prevBlock = localSurvey.blocks.find((b) => b.id === prevBlockId);
    if (prevBlock?.elements[0]) {
      revertRequiredChangesByQuestion(prevBlock.elements[0].id);
    }

    setBlockId(prevBlockId);
  };

  const retryResponse = async () => {
    if (responseQueue) {
      setIsRetrying(true);
      const result = await responseQueue.processQueue();
      setIsRetrying(false);

      if (result.success) {
        setShowError(false);
        setErrorType(undefined);
      }
    } else {
      onRetry?.();
    }
  };

  const getCardContent = (blockIdx: number, offset: number): JSX.Element | undefined => {
    if (showError) {
      switch (errorType) {
        case TResponseErrorCodesEnum.ResponseSendingError:
          return (
            <>
              {localSurvey.type !== "link" ? (
                <div className="bg-survey-bg relative w-full">
                  <div
                    className={cn(
                      "flex w-full items-center justify-end",
                      SURVEY_CLOSE_BUTTON_ROW_CLASS_NAME
                    )}>
                    <SurveyCloseButton
                      onClose={onClose}
                      hoverColor={getHoverColor(styling)}
                      borderRadius={styling.roundness ?? 8}
                    />
                  </div>
                </div>
              ) : null}
              <ResponseErrorComponent
                responseData={responseQueue?.getUnsentData() ?? responseData}
                questions={questions}
                onRetry={retryResponse}
                isRetrying={isRetrying}
              />
            </>
          );
        case TResponseErrorCodesEnum.RecaptchaError:
        case TResponseErrorCodesEnum.InvalidDeviceError:
        case TResponseErrorCodesEnum.ResponseAlreadyCompleted:
        case TResponseErrorCodesEnum.ResponseSendingErrorPermanent:
          return (
            <>
              {localSurvey.type !== "link" ? (
                <div className="bg-survey-bg relative w-full">
                  <div
                    className={cn(
                      "flex w-full items-center justify-end",
                      SURVEY_CLOSE_BUTTON_ROW_CLASS_NAME
                    )}>
                    <SurveyCloseButton
                      onClose={onClose}
                      hoverColor={getHoverColor(styling)}
                      borderRadius={styling.roundness ?? 8}
                    />
                  </div>
                </div>
              ) : null}
              <ErrorComponent errorType={errorType} />
            </>
          );
      }
    }

    const content = () => {
      if (blockIdx === -1) {
        return (
          <WelcomeCard
            key="start"
            headline={localSurvey.welcomeCard.headline}
            subheader={localSurvey.welcomeCard.subheader}
            fileUrl={localSurvey.welcomeCard.fileUrl}
            videoUrl={localSurvey.welcomeCard.videoUrl}
            buttonLabel={localSurvey.welcomeCard.buttonLabel}
            onSubmit={onSubmit}
            survey={localSurvey}
            languageCode={selectedLanguage}
            responseCount={responseCount}
            autoFocusEnabled={autoFocusEnabled || hasUserNavigatedRef.current}
            isCurrent={offset === 0}
            responseData={recallValues}
            variablesData={currentVariables}
            isPreviewMode={isPreviewMode}
            fullSizeCards={fullSizeCards}
            isCardless={isCardless}
          />
        );
      } else if (blockIdx >= localSurvey.blocks.length) {
        const endingCard = localSurvey.endings.find((ending) => {
          return ending.id === blockId;
        });
        if (endingCard) {
          return (
            <EndingCard
              survey={localSurvey}
              endingCard={endingCard}
              isRedirectDisabled={isRedirectDisabled}
              autoFocusEnabled={autoFocusEnabled || hasUserNavigatedRef.current}
              isCurrent={offset === 0}
              languageCode={selectedLanguage}
              isResponseSendingFinished={isResponseSendingFinished}
              responseData={recallValues}
              variablesData={currentVariables}
              onOpenExternalURL={onOpenExternalURL}
              isPreviewMode={isPreviewMode}
              fullSizeCards={fullSizeCards}
              isCardless={isCardless}
              isOfflineWithPending={offlinePersistEnabled && !isOnline && isSurveyFinished}
            />
          );
        }
      } else {
        const block = localSurvey.blocks[blockIdx];
        // Re-evaluated on every render, so a question appears or hides as the answers above it change,
        // and its options are filtered live (ENG-6937).
        const pageVisibility = getPageVisibility({
          survey: localSurvey,
          blockId: block?.id ?? "",
          responseData,
          variables: currentVariables,
          selectedLanguage,
          reservedFieldValues: reservedValues,
        });
        const { visibleElementIds, optionsNotShown } = pageVisibility;
        return (
          Boolean(block) && (
            <BlockConditional
              surveyLanguages={localSurvey.languages}
              key={block.id}
              surveyId={localSurvey.id}
              block={{
                ...block,
                elements: block.elements.map((element) =>
                  withOptionsShown(
                    parseRecallInformation(element, selectedLanguage, recallValues, currentVariables),
                    optionsNotShown[element.id]
                  )
                ),
              }}
              value={getPageAnswers(responseData, pageVisibility)}
              onChange={onChange}
              onSubmit={onSubmit}
              onBack={onBack}
              ttc={ttc}
              setTtc={setTtc}
              onFileUpload={onFileUpload}
              isFirstBlock={
                block.id === localSurvey.blocks[0]?.id || (history.length === 0 && block.id === entryBlockId)
              }
              visibleElementIds={visibleElementIds}
              skipPrefilled={skipPrefilled && !isNavigatingBackRef.current}
              prefilledResponseData={offset === 0 ? prefillResponseData : undefined}
              isLastBlock={block.id === localSurvey.blocks[localSurvey.blocks.length - 1].id}
              languageCode={selectedLanguage}
              autoFocusEnabled={autoFocusEnabled}
              shouldFocusOnMount={autoFocusEnabled || hasUserNavigatedRef.current}
              isBackButtonHidden={localSurvey.isBackButtonHidden}
              isAutoProgressingEnabled={localSurvey.isAutoProgressingEnabled}
              onOpenExternalURL={onOpenExternalURL}
              dir={dir}
              fullSizeCards={fullSizeCards}
              isCardless={isCardless}
            />
          )
        );
      }
    };

    const isLanguageSwitchVisible = getShowLanguageSwitch(offset);
    const isCloseButtonVisible = getShowSurveyCloseButton(offset);
    // The close button floats in the corner beside the question instead of taking a row of its own.
    // It keeps the row when the language switch shares it (the switch's width follows the language
    // name) and when the card opens with media it would cover.
    const isCloseButtonBesideContent =
      isCloseButtonVisible && !isLanguageSwitchVisible && !getCardStartsWithMedia(localSurvey, blockId);

    return (
      <AutoCloseWrapper
        survey={localSurvey}
        onClose={onClose}
        questionIdx={blockIdx} // Now tracks block index, not question index
        hasInteracted={hasInteracted}
        setHasInteracted={setHasInteracted}>
        <div
          // No background of its own: the card wrapper around it (the `card` styling hook) already
          // paints bg-survey-bg, and a second fill here would cover a background set on that hook.
          className={cn(
            "no-scrollbar flex w-full flex-col justify-between transition-opacity duration-1000 ease-in-out",
            isCardless ? "" : "h-full overflow-hidden",
            offset === 0 || cardArrangement === "simple" || isCardless ? "opacity-100" : "opacity-0"
          )}>
          <div className={cn("relative")}>
            {(!isCardless && showProgressBar) || isLanguageSwitchVisible || isCloseButtonVisible ? (
              <div className="flex w-full flex-col items-end">
                {!isCardless && showProgressBar ? (
                  <ProgressBar survey={localSurvey} blockId={blockId} />
                ) : null}

                {isCloseButtonVisible || isLanguageSwitchVisible ? (
                  <div
                    className={cn(
                      isCloseButtonBesideContent ? "absolute end-0 w-fit" : "relative w-full",
                      // Below the progress bar (h-2) when there is one.
                      isCloseButtonBesideContent && !isCardless && showProgressBar && "top-2",
                      isCloseButtonBesideContent && (isCardless || !showProgressBar) && "top-0"
                    )}>
                    <div
                      className={cn(
                        "flex w-full items-center justify-end",
                        isCloseButtonVisible ? SURVEY_CLOSE_BUTTON_ROW_CLASS_NAME : "h-8"
                      )}>
                      {isLanguageSwitchVisible && (
                        <LanguageSwitch
                          survey={localSurvey}
                          surveyLanguages={localSurvey.languages}
                          selectedLanguageCode={selectedLanguage}
                          setSelectedLanguageCode={setSelectedLanguage}
                          hoverColor={getHoverColor(styling)}
                          borderRadius={styling.roundness ?? 8}
                          setDir={setDir}
                          dir={dir}
                        />
                      )}
                      {isLanguageSwitchVisible && isCloseButtonVisible && (
                        <div aria-hidden="true" className="z-1001 h-5 w-px bg-slate-200" />
                      )}

                      {isCloseButtonVisible && (
                        <SurveyCloseButton
                          onClose={onClose}
                          hoverColor={getHoverColor(styling)}
                          borderRadius={styling.roundness ?? 8}
                        />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div
              ref={contentRef}
              className={cn(
                loadingElement ? "animate-pulse opacity-60" : "",
                fullSizeCards ? "" : "my-auto",
                isCloseButtonBesideContent && SURVEY_CLOSE_BUTTON_HEADLINE_CLEARANCE_CLASS_NAME,
                isCloseButtonBesideContent && SURVEY_CLOSE_BUTTON_SCROLL_FADE_CLASS_NAME
              )}>
              {content()}
            </div>

            <div
              className={cn(
                "flex flex-col justify-center gap-2",
                isCloseButtonVisible || isLanguageSwitchVisible ? "p-2" : "p-3"
              )}>
              {isBrandingEnabled ? <FormbricksBranding /> : null}
              {isSpamProtectionEnabled ? <RecaptchaBranding /> : null}
            </div>
          </div>
        </div>
      </AutoCloseWrapper>
    );
  };

  // Survey instructions, available on every page. They live on the welcome card, which the
  // respondent leaves after one click and can never get back to — so the text that explains what the
  // survey is for was gone for the rest of it (the second half of the 2.4.2 VPAT finding).
  //
  // Rendered once here rather than inside getCardContent, which runs per card and would emit a
  // duplicate id for every peeking card in the stacked layout. Visually hidden: the card designs
  // have no room for a persistent block, and a sighted respondent has already read it on the
  // welcome card. SurveyContainer points the form's aria-describedby at this id, so a screen reader
  // announces it on entry to each page.
  const instructions = hasSurveyInstructions(localSurvey) ? (
    <div id={SURVEY_INSTRUCTIONS_ID} className="sr-only">
      <Subheader
        subheader={replaceRecallInfo(
          getLocalizedValue(localSurvey.welcomeCard.subheader, selectedLanguage),
          // The same lookup the visible welcome card recalls from, so a reserved token like
          // `#recall:url#` resolves here too instead of staying literal.
          recallValues,
          currentVariables,
          selectedLanguage
        )}
      />
    </div>
  ) : null;

  const stackedCardsContainer = (
    <StackedCardsContainer
      cardArrangement={cardArrangement}
      currentBlockId={blockId}
      getCardContent={getCardContent}
      survey={localSurvey}
      styling={styling}
      setBlockId={setBlockId}
      shouldResetBlockId={shouldResetQuestionId}
      fullSizeCards={fullSizeCards}
      placement={placement}
      hasError={showError}
    />
  );

  if (isCardless) {
    return (
      <CardlessSurveyLayout
        survey={localSurvey}
        blockId={blockId}
        styling={styling}
        showProgressBar={showProgressBar}
        isPreviewMode={isPreviewMode}
        showCardlessPreviewLogoSlot={showCardlessPreviewLogoSlot}
        linkSurveyCardMaxWidth={linkSurveyCardMaxWidth}>
        <>
          {instructions}
          {stackedCardsContainer}
        </>
      </CardlessSurveyLayout>
    );
  }

  return (
    <>
      {instructions}
      {stackedCardsContainer}
    </>
  );
}
