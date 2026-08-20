import { type JSX } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  type TIngestDropReason,
  type TIngestFlagReason,
  type TIngestResult,
  applyIngestContract,
} from "@formbricks/types/embedded-data-ingest";
import {
  RESERVED_FIELD_CATALOG,
  coerceToEmbeddedDataType,
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
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
import { TSurveyBlock, TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { BlockConditional } from "@/components/general/block-conditional";
import { EndingCard } from "@/components/general/ending-card";
import { ErrorComponent } from "@/components/general/error-component";
import { FormbricksBranding } from "@/components/general/formbricks-branding";
import { LanguageSwitch } from "@/components/general/language-switch";
import { ProgressBar } from "@/components/general/progress-bar";
import { RecaptchaBranding } from "@/components/general/recaptcha-branding";
import { ResponseErrorComponent } from "@/components/general/response-error-component";
import { SurveyCloseButton } from "@/components/general/survey-close-button";
import { WelcomeCard } from "@/components/general/welcome-card";
import { AutoCloseWrapper } from "@/components/wrappers/auto-close-wrapper";
import { CardlessSurveyLayout } from "@/components/wrappers/cardless-survey-layout";
import { StackedCardsContainer } from "@/components/wrappers/stacked-cards-container";
import { ApiClient } from "@/lib/api-client";
import { type TWebSurveyMeta, createWebSurveyMetaSnapshot } from "@/lib/browser-context";
import { evaluateLogic, performActions } from "@/lib/logic";
import {
  type SerializedSurveyState,
  clearSurveyProgress,
  getSurveyProgress,
  patchSurveyProgressSnapshot,
  saveSurveyProgress,
} from "@/lib/offline-storage";
import { parseRecallInformation } from "@/lib/recall";
import { ResponseQueue } from "@/lib/response-queue";
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

/**
 * What the renderer says about each verdict. Phrased as what happened to the *incoming value*, never
 * as a claim about the response: a host surface can legitimately hand this component a key the survey
 * does not declare — the link page passes the verified email address alongside the URL params — and
 * the server writes that one itself, so "ignored here" is the honest report and "not stored" would
 * not be.
 */
const INGEST_DROP_MESSAGES: Record<TIngestDropReason, string> = {
  unknown_key: "is not an ingested Embedded Data field on this survey",
  locked_field: "is locked and ignores values set from outside",
  unsupported_value: "arrived as a value no Embedded Data field can hold",
  element_id_collision: "is a question's id, so that question's answer owns the key",
};

const INGEST_FLAG_MESSAGES: Record<TIngestFlagReason, string> = {
  coercion_failed: "did not match its declared type and was kept as text",
  truncated: "was longer than the 16 KB limit and was truncated",
};

/**
 * Surfaces the ingest contract's verdicts, so a developer wiring up Embedded Data sees why a value
 * did not show up instead of guessing. Warnings, never errors: nothing here blocks a response.
 *
 * Advisory only. The stored flags are the server's, recomputed on ingest from the same contract,
 * because a client-sent flag list could claim there was nothing to report.
 */
const logIngestResult = ({ dropped, flags }: TIngestResult): void => {
  for (const { key, reason } of dropped) {
    console.warn(`Formbricks: "${key}" ${INGEST_DROP_MESSAGES[reason]}, so the value was ignored.`);
  }
  for (const { key, reason } of flags) {
    console.warn(`Formbricks: the value for "${key}" ${INGEST_FLAG_MESSAGES[reason]}.`);
  }
};

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
  singleUseId,
  singleUseResponseId,
  pinAuthToken,
  isWebEnvironment = true,
  getRecaptchaToken,
  isSpamProtectionEnabled,
  dir = "auto",
  setDir,
  onLanguageChange,
  placement,
  offlineSupport = false,
  onOfflineStatusChange,
  showCardlessPreviewLogoSlot = false,
}: Readonly<SurveyContainerProps>) {
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
  const [currentVariables, setCurrentVariables] = useState<TResponseVariables>({});

  const isLinkSurvey = survey.type === "link";
  const offlinePersistEnabled = offlineSupport && isLinkSurvey && !isPreviewMode && !!appUrl && !!workspaceId;

  const persistSurveyStateSnapshot = useCallback(
    async (snapshotPatch: Partial<SerializedSurveyState>) => {
      if (!offlinePersistEnabled) return;
      await patchSurveyProgressSnapshot(survey.id, snapshotPatch);
    },
    [offlinePersistEnabled, survey.id]
  );

  const responseQueue = useMemo(() => {
    if (appUrl && workspaceId && surveyState) {
      return new ResponseQueue(
        {
          appUrl,
          workspaceId,
          retryAttempts: 4,
          persistOffline: offlinePersistEnabled,
          surveyId: survey.id,
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

  // ENG-1837: computed fields are seeded from their definitions in the EmbeddedData tables, falling
  // back to the legacy `variables` column for surveys whose rows are not joined in. Only `variables`
  // and `embeddedFields` are passed (and depended on): a computed field can never be derived from
  // `hiddenFields`, so nothing else can change this map.
  useEffect(() => {
    setCurrentVariables(
      getComputedEmbeddedFields({
        variables: survey.variables,
        embeddedFields: survey.embeddedFields,
      }).reduce<TResponseVariables>((acc, { field, link }) => {
        // Provably the variable's declared value for every field derived from the legacy shape:
        // ZSurveyVariable pins a number variable to a number and a text one to a string, and both
        // are pass-throughs here (see the seeding test in embedded-data-mapping.test.ts). Booleans
        // and dates have no slot in TResponseVariables and no computed field can carry one.
        const seed = coerceToEmbeddedDataType(field.defaultValue, field.dataType);
        if (typeof seed === "string" || typeof seed === "number") acc[link.storageKey] = seed;
        return acc;
      }, {})
    );
  }, [survey.variables, survey.embeddedFields]);

  const autoFocusEnabled = autoFocus ?? window.self === window.top;

  // Block-based navigation: track current block ID instead of question ID
  const [blockId, setBlockId] = useState(() => {
    if (startAtQuestionId) {
      // If starting at a specific question, find its parent block
      const startBlock = findBlockByElementId(localSurvey.blocks, startAtQuestionId);
      return startBlock?.id || localSurvey.blocks[0]?.id;
    } else if (localSurvey.welcomeCard.enabled) {
      return "start";
    }

    return localSurvey.blocks[0]?.id;
  });

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
  const isNavigatingBackRef = useRef(false);
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
      params
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
      if (onDisplayCreated) {
        onDisplayCreated();
      }
      if (onDisplay) {
        onDisplay();
      }
      return;
    }

    if (apiClient && surveyState && responseQueue) {
      try {
        const display = await apiClient.createDisplay({
          surveyId: survey.id,
          ...(userId && { userId }),
          ...(contactId && { contactId }),
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
    onDisplayCreated,
    isPreviewMode,
    onDisplay,
    persistSurveyStateSnapshot,
  ]);

  // Create display on mount. When offline persistence is enabled, wait for progress
  // restoration so we can skip creating a new display if a session was restored.
  const displayCreatedRef = useRef(false);

  // `onResponseCreateOrUpdate` runs on every question submit, but a response is only *created* on the
  // first submit — later submits update it. `onResponseCreated` must therefore fire once, not per
  // question, otherwise a 5-question survey triggers 5 downstream `/user` refreshes in js-core.
  const responseCreatedRef = useRef(false);

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
      createDisplay();
    } else {
      onDisplay?.();
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
        const isEndingCard = localSurvey.endings.some((e) => e.id === progress.blockId);
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
        setBlockId(progress.blockId);
        setResponseData(progress.responseData);
        setTtc(progress.ttc);
        setCurrentVariables(progress.currentVariables);
        setHistory(progress.history);
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

  const onChange = (responseDataUpdate: TResponseData) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
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

  const evaluateLogicAndGetNextBlockId = (
    data: TResponseData,
    /**
     * Reserved-field values, passed in rather than closed over: this is declared above the memo that
     * produces them, and taking them as a parameter keeps the sole call site explicit about the fact
     * that logic reads the same map recall does.
     */
    reservedFieldValues: Record<string, string | number>
  ): { nextBlockId: string | undefined; calculatedVariables: TResponseVariables } => {
    const firstEndingId = survey.endings.length > 0 ? survey.endings[0].id : undefined;

    if (blockId === "start")
      return {
        nextBlockId: localSurvey.blocks[0]?.id || firstEndingId,
        calculatedVariables: {},
      };

    if (!currentBlock) {
      console.error(
        "Block not found. blockId:",
        blockId,
        "available blocks:",
        localSurvey.blocks.map((b) => b.id)
      );
      throw new Error("Block not found");
    }

    const localResponseData = { ...responseData, ...data };
    let calculationResults = { ...currentVariables };

    // Process a single logic rule
    const processLogicRule = (
      logic: TSurveyBlockLogic,
      currentJumpTarget: string | undefined,
      currentRequiredIds: string[]
    ): { jumpTarget: string | undefined; requiredIds: string[]; updatedCalculations: TResponseVariables } => {
      const isLogicMet = evaluateLogic(
        localSurvey,
        localResponseData,
        calculationResults,
        logic.conditions,
        selectedLanguage,
        // Merged against the in-flight response data (answers from this block included), so a
        // declared field shadows a same-named reserved entry here exactly as it does in recall.
        mergeReservedValues(reservedFieldValues, localResponseData)
      );

      if (!isLogicMet) {
        return {
          jumpTarget: currentJumpTarget,
          requiredIds: currentRequiredIds,
          updatedCalculations: calculationResults,
        };
      }

      const { jumpTarget, requiredQuestionIds, calculations } = performActions(
        localSurvey,
        logic.actions,
        localResponseData,
        calculationResults
      );

      const newJumpTarget = jumpTarget && !currentJumpTarget ? jumpTarget : currentJumpTarget;
      const newRequiredIds = [...currentRequiredIds, ...requiredQuestionIds];
      const updatedCalculations = { ...calculationResults, ...calculations };

      return {
        jumpTarget: newJumpTarget,
        requiredIds: newRequiredIds,
        updatedCalculations,
      };
    };

    // Evaluate block-level logic
    const evaluateBlockLogic = () => {
      let firstJumpTarget: string | undefined;
      const allRequiredQuestionIds: string[] = [];

      if (currentBlock.logic && currentBlock.logic.length > 0) {
        for (const logic of currentBlock.logic) {
          const result = processLogicRule(logic, firstJumpTarget, allRequiredQuestionIds);
          firstJumpTarget = result.jumpTarget;
          allRequiredQuestionIds.length = 0;
          allRequiredQuestionIds.push(...result.requiredIds);
          calculationResults = result.updatedCalculations;
        }
      }

      // Use logicFallback if no jump target was set
      if (!firstJumpTarget && currentBlock.logicFallback) {
        firstJumpTarget = currentBlock.logicFallback;
      }

      return { firstJumpTarget, allRequiredQuestionIds };
    };

    const { firstJumpTarget, allRequiredQuestionIds } = evaluateBlockLogic();

    // Handle required questions
    const handleRequiredQuestions = (requiredIds: string[]) => {
      if (requiredIds.length > 0) {
        if (currentBlock.elements[0]) {
          questionRequiredByMap.current[currentBlock.elements[0].id] = requiredIds;
        }
        makeQuestionsRequired(requiredIds);
      }
    };

    handleRequiredQuestions(allRequiredQuestionIds);

    // Return the jump target (which is a block ID) or the next block in sequence
    const nextBlockId = firstJumpTarget || localSurvey.blocks[currentBlockIndex + 1]?.id;

    return {
      nextBlockId,
      calculatedVariables: calculationResults,
    };
  };

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
  webSurveyMetaRef.current ??= createWebSurveyMetaSnapshot(isWebEnvironment);

  const getWebSurveyMeta = useCallback((): TWebSurveyMeta => webSurveyMetaRef.current?.() ?? {}, []);

  // Fire onResponseCreated exactly once per survey lifecycle. The queue creates the response on the
  // first add and updates it on later submits, so a multi-question survey must not re-trigger it.
  const triggerResponseCreatedOnce = useCallback(() => {
    if (responseCreatedRef.current) return;
    responseCreatedRef.current = true;
    onResponseCreated?.();
  }, [onResponseCreated]);

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
        responseQueue.add({
          data: responseUpdate.data,
          ttc: responseUpdate.ttc,
          finished: responseUpdate.finished,
          language:
            responseUpdate.language === "default" ? getDefaultLanguageCode(survey) : responseUpdate.language,
          meta: {
            ...getWebSurveyMeta(),
            action,
          },
          variables: responseUpdate.variables,
          displayId: surveyState.displayId,
          endingId: responseUpdate.endingId,
          // The filtered record, not the raw prop: `ResponseQueue` merges `hiddenFields` over `data`
          // on every submit, so sending the raw bag here would put the dropped and uncoerced values
          // straight back.
          hiddenFields: ingestedFieldsRecord,
        });

        triggerResponseCreatedOnce();
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
      ingestedFieldsRecord,
      getWebSurveyMeta,
    ]
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
      projectClientReservedValues(RESERVED_FIELD_CATALOG, {
        surveyId: localSurvey.id,
        language:
          selectedLanguage === "default" ? (getDefaultLanguageCode(survey) ?? null) : selectedLanguage,
        data: responseData,
        variables: currentVariables,
        ttc,
        meta: { ...getWebSurveyMeta(), action },
      }),
    [localSurvey.id, selectedLanguage, survey, responseData, currentVariables, ttc, getWebSurveyMeta, action]
  );

  /** Recall's lookup map: reserved values first, so a declared field of the same name still wins. */
  const recallValues = useMemo(
    () => mergeReservedValues(reservedValues, responseData),
    [reservedValues, responseData]
  );

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
      onFinished?.();
    }
  }, [isResponseSendingFinished, isSurveyFinished, onFinished]);

  // The outgoing card stays visible while the card transition cross-fades, so a
  // control that kept focus would show its focus ring hanging mid-fade before
  // vanishing with the card. Drop focus when navigation starts; the incoming
  // card focuses its first control on mount.
  const blurOutgoingCard = (): void => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  };

  const onSubmit = async (surveyResponseData: TResponseData, responsettc: TResponseTtc) => {
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

    const { nextBlockId: rawNextBlockId, calculatedVariables } = evaluateLogicAndGetNextBlockId(
      surveyResponseData,
      reservedValues
    );
    // A jump target may reference a deleted block or ending; treat such stale ids as "no target"
    // so the shown ending and the persisted endingId stay in sync
    const targetIsBlock = localSurvey.blocks.some((block) => block.id === rawNextBlockId);
    const targetIsEnding = localSurvey.endings.some((ending) => ending.id === rawNextBlockId);
    const isValidTarget = targetIsBlock || targetIsEnding;
    const nextBlockId = isValidTarget ? rawNextBlockId : undefined;
    const finished =
      nextBlockId === undefined || !localSurvey.blocks.map((block) => block.id).includes(nextBlockId);

    setIsSurveyFinished(finished);

    // The ending that will be shown: an explicit jump target, or the first ending when the survey
    // falls off the last block (mirrors the display fallback below so the persisted endingId matches it)
    const endingId = finished
      ? (localSurvey.endings.find((ending) => ending.id === nextBlockId)?.id ?? localSurvey.endings[0]?.id)
      : undefined;

    onChange(surveyResponseData);
    onChangeVariables(calculatedVariables);

    onResponseCreateOrUpdate({
      data: surveyResponseData,
      ttc: responsettc,
      finished,
      variables: calculatedVariables,
      language: selectedLanguage,
      endingId,
    });

    if (nextBlockId) {
      setBlockId(nextBlockId);
    } else if (finished) {
      // Survey is finished, show the first ending or set to a value > blocks.length
      const firstEndingId = localSurvey.endings[0]?.id as string | undefined;
      if (firstEndingId) {
        setBlockId(firstEndingId);
      } else {
        // No endings defined, set blockId to trigger ending screen
        setBlockId("end");
      }
    }
    // add current block to history
    const newHistory = [...history, blockId];
    setHistory(newHistory);

    // --- Offline support: save progress on each submit ---
    if (offlinePersistEnabled) {
      const newBlockId = finished ? endingId || localSurvey.endings[0]?.id || "end" : nextBlockId || blockId;

      void saveSurveyProgress({
        surveyId: survey.id,
        blockId: newBlockId,
        responseData: { ...responseData, ...surveyResponseData },
        ttc: { ...ttc, ...responsettc },
        currentVariables: calculatedVariables,
        history: newHistory,
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
    isNavigatingBackRef.current = true;
    hasUserNavigatedRef.current = true;
    blurOutgoingCard();

    let prevBlockId: string | undefined;
    // use history if available
    if (history.length > 0) {
      const newHistory = [...history];
      prevBlockId = newHistory.pop();
      setHistory(newHistory);
    } else {
      // otherwise go back to previous block in array
      prevBlockId = localSurvey.blocks[currentBlockIndex - 1]?.id;
    }
    popVariableState();
    if (!prevBlockId) throw new Error("Block not found");

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
                <div className="bg-survey-bg relative h-8 w-full">
                  <div className="flex w-full items-center justify-end">
                    <SurveyCloseButton
                      onClose={onClose}
                      hoverColor={styling.inputBgColor?.light ?? "#f8fafc"}
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
                <div className="bg-survey-bg relative h-8 w-full">
                  <div className="flex w-full items-center justify-end">
                    <SurveyCloseButton
                      onClose={onClose}
                      hoverColor={styling.inputBgColor?.light ?? "#f8fafc"}
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
        return (
          Boolean(block) && (
            <BlockConditional
              surveyLanguages={localSurvey.languages}
              key={block.id}
              surveyId={localSurvey.id}
              block={{
                ...block,
                elements: block.elements.map((element) =>
                  parseRecallInformation(element, selectedLanguage, recallValues, currentVariables)
                ),
              }}
              value={responseData}
              onChange={onChange}
              onSubmit={onSubmit}
              onBack={onBack}
              ttc={ttc}
              setTtc={setTtc}
              onFileUpload={onFileUpload}
              isFirstBlock={block.id === localSurvey.blocks[0]?.id}
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

    return (
      <AutoCloseWrapper
        survey={localSurvey}
        onClose={onClose}
        questionIdx={blockIdx} // Now tracks block index, not question index
        hasInteracted={hasInteracted}
        setHasInteracted={setHasInteracted}>
        <div
          className={cn(
            "no-scrollbar flex w-full flex-col justify-between transition-opacity duration-1000 ease-in-out",
            isCardless ? "" : "bg-survey-bg h-full overflow-hidden",
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
                      "relative w-full",
                      isCloseButtonVisible || isLanguageSwitchVisible ? "h-8" : "h-5"
                    )}>
                    <div className={cn("flex w-full items-center justify-end")}>
                      {isLanguageSwitchVisible && (
                        <LanguageSwitch
                          survey={localSurvey}
                          surveyLanguages={localSurvey.languages}
                          setSelectedLanguageCode={setSelectedLanguage}
                          hoverColor={styling.inputBgColor?.light ?? "#f8fafc"}
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
                          hoverColor={styling.inputBgColor?.light ?? "#f8fafc"}
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
                fullSizeCards ? "" : "my-auto"
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
        {stackedCardsContainer}
      </CardlessSurveyLayout>
    );
  }

  return stackedCardsContainer;
}
