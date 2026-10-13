"use client";

import { ArrowLeftIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";
import formbricks from "@formbricks/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  TSurvey,
  TSurveyEditorTabs,
  TSurveyStatus,
  TSurveyVisibility,
  ZSurvey,
  ZSurveyEndScreenCard,
  ZSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import type { TSurveyAccess } from "@/lib/survey/visibility/access";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { isDeepEqual } from "@/lib/utils/object";
import { reportStaleServerActionError } from "@/lib/utils/stale-server-action";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import type { TCustomCssValidationStatus } from "@/modules/custom-css/components/lib/validation";
import { type TWorkspaceWithoutCustomCss } from "@/modules/custom-css/lib/types";
import { createSegmentAction } from "@/modules/ee/contacts/segments/actions";
import {
  getSurveyToAutosave,
  isCustomCssBlockingManualSave,
} from "@/modules/survey/editor/lib/custom-css-autosave";
import { getLogicDestinationErrorMessage } from "@/modules/survey/editor/lib/logic-destination-error";
import { hasUnsavedSurveyChanges, isJustSavedBypassValid } from "@/modules/survey/editor/lib/unsaved-changes";
import { scrollElementCardIntoView } from "@/modules/survey/editor/lib/utils";
import { TSurveyDraft } from "@/modules/survey/editor/types/survey";
import { ActivateDialog } from "@/modules/survey/visibility/components/activate-dialog";
import { CollaborateModal } from "@/modules/survey/visibility/components/collaborate-modal";
import { useUpdateSurveyVisibility } from "@/modules/survey/visibility/hooks/use-update-survey-visibility";
import {
  type TActivationStep,
  planActivation,
  shouldAskWhoCanView,
} from "@/modules/survey/visibility/lib/activate-flow";
import { getRestrictedAuthor } from "@/modules/survey/visibility/lib/collaborate";
import { type TSurveyVisibilityUiGate, showVisibilityControls } from "@/modules/survey/visibility/lib/state";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { updateSurveyAction, updateSurveyDraftAction } from "../actions";
import { type TAutoSaveFailure } from "../lib/auto-save-badge";
import { createSaveAttemptOrder } from "../lib/save-attempt-order";
import { describeElementIssue, isMissingRequiredTrigger, isSurveyValid } from "../lib/validation";
import { AutoSaveIndicator } from "./auto-save-indicator";

interface SurveyMenuBarProps {
  localSurvey: TSurvey;
  survey: TSurvey;
  /** React's own setter: the auto-save adopts through the updater form, so a value alone is not enough. */
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  activeId: TSurveyEditorTabs;
  setActiveId: React.Dispatch<React.SetStateAction<TSurveyEditorTabs>>;
  setInvalidElements: React.Dispatch<React.SetStateAction<string[] | null>>;
  setHasTriggerError: React.Dispatch<React.SetStateAction<boolean>>;
  workspace: TWorkspaceWithoutCustomCss;
  responseCount: number;
  finishedResponseCount: number;
  selectedLanguageCode: string;
  isCxMode: boolean;
  locale: string;
  setIsCautionDialogOpen: (open: boolean) => void;
  isStorageConfigured: boolean;
  /**
   * ENG-3395: the restricted-surveys gate — the server-side flags, with the controls turned off for
   * the rest of the session when the server reports visibility as not enabled. Owned by the editor,
   * which the Follow-ups tab reads as well.
   */
  visibilityGate: TSurveyVisibilityUiGate;
  /** The effective visibility, from the server; pending counts as restricted. */
  effectiveVisibility: TSurveyVisibility;
  /** A change was stored (in effect or pending): the editor refreshes what it shows from the server. */
  onVisibilityChanged: () => void;
  onVisibilityNotEnabled: () => void;
  /** Why this user can see the survey; `null` while the gate is off. */
  surveyAccess: TSurveyAccess | null;
  /** The author's display name; `null` when the survey has no owner or the gate is off. */
  ownerName: string | null;
  /**
   * Where the check of the survey's Custom CSS draft stands (ENG-3553). Saving and publishing are
   * blocked while it is `invalid`; the autosave sends the draft only once it is `valid` (or there is
   * no CSS) and keeps the last saved CSS otherwise, so other edits still save.
   */
  customCssValidationStatus?: TCustomCssValidationStatus;
}

export const SurveyMenuBar = ({
  localSurvey,
  survey,
  setLocalSurvey,
  activeId,
  setActiveId,
  setInvalidElements,
  setHasTriggerError,
  workspace,
  responseCount,
  finishedResponseCount,
  selectedLanguageCode,
  isCxMode,
  locale,
  setIsCautionDialogOpen,
  isStorageConfigured = true,
  visibilityGate,
  effectiveVisibility,
  onVisibilityChanged,
  onVisibilityNotEnabled,
  surveyAccess,
  ownerName,
  customCssValidationStatus = "empty",
}: Readonly<SurveyMenuBarProps>) => {
  const workspaceBasePath = `/workspaces/${workspace.id}`;
  const { t } = useTranslation();
  const router = useRouter();
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isLinkSurvey, setIsLinkSurvey] = useState(true);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSurveyPublishing, setIsSurveyPublishing] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  // Set when an auto-save tick does not land -- the request failed, or the server refused it -- and
  // cleared by the next save that does. `retrying` while the tick keeps going (it re-sends the whole
  // draft, so a retry cannot apply anything twice); `stopped` once a stale deployment has ended it.
  // This only makes sure the indicator stops claiming the work is safe while it is not (ENG-2899).
  const [autoSaveFailure, setAutoSaveFailure] = useState<TAutoSaveFailure | null>(null);
  // The indicator follows the newest save attempt to settle, by start order, not whichever response
  // arrives last. Next.js happens to send server actions one at a time today, so they settle in start
  // order anyway; see save-attempt-order.ts for why that is not relied on. One ordering per editor.
  const [saveAttemptOrder] = useState(createSaveAttemptOrder);
  const isSuccessfullySavedRef = useRef(false);
  const isAutoSavingRef = useRef(false);
  const isSurveyPublishingRef = useRef(false);

  // Refs for interval-based auto-save (to access current values without re-creating interval)
  const localSurveyRef = useRef(localSurvey);
  const surveyRef = useRef(survey);
  const isSurveySavingRef = useRef(isSurveySaving);
  // A snapshot of what the last successful save returned. The `survey` prop is the other persisted
  // state; the two are not interchangeable, so the dirty checks below compare against both. Cloned
  // rather than aliased, so a later in-place edit of the editor's own survey cannot drag the
  // snapshot along with it and hide the change.
  const lastSavedSurveyRef = useRef<TSurvey | null>(null);

  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [isCollaborateModalOpen, setIsCollaborateModalOpen] = useState(false);
  const [isChangingVisibility, setIsChangingVisibility] = useState(false);
  const updateSurveyVisibility = useUpdateSurveyVisibility();
  const canManageVisibility = showVisibilityControls(visibilityGate, surveyAccess);
  const restrictedAuthor = getRestrictedAuthor(surveyAccess, ownerName);

  // Stable: the Collaborate modal runs it from an effect.
  const handleVisibilityNotEnabled = useCallback(() => {
    onVisibilityNotEnabled();
    setIsActivateDialogOpen(false);
  }, [onVisibilityNotEnabled]);

  useEffect(() => {
    if (audiencePrompt && activeId === "settings") {
      setAudiencePrompt(false);
    }
  }, [activeId, audiencePrompt]);

  useEffect(() => {
    setIsLinkSurvey(localSurvey.type === "link");
  }, [localSurvey.type]);

  // Keep refs updated for interval-based auto-save
  useEffect(() => {
    localSurveyRef.current = localSurvey;
  }, [localSurvey]);

  useEffect(() => {
    surveyRef.current = survey;
  }, [survey]);

  const customCssValidationStatusRef = useRef(customCssValidationStatus);
  useEffect(() => {
    customCssValidationStatusRef.current = customCssValidationStatus;
  }, [customCssValidationStatus]);

  useEffect(() => {
    isSurveySavingRef.current = isSurveySaving;
  }, [isSurveySaving]);

  // Reset the successfully saved flag when survey prop updates (page refresh complete)
  useEffect(() => {
    if (isSuccessfullySavedRef.current) {
      isSuccessfullySavedRef.current = false;
    }
  }, [survey]);

  // An autosave sets the flag above without producing the `survey` prop that clears it, so a later
  // edit would keep the unload warning suppressed and let a reload discard it (ENG-2330).
  useEffect(() => {
    // Guarded rather than folded into the condition: this runs on every keystroke, and there is
    // nothing to retire while the bypass is not set.
    if (!isSuccessfullySavedRef.current) {
      return;
    }

    const isBypassValid = isJustSavedBypassValid(
      isSuccessfullySavedRef.current,
      hasUnsavedSurveyChanges(localSurvey, [survey, lastSavedSurveyRef.current])
    );

    if (!isBypassValid) {
      isSuccessfullySavedRef.current = false;
    }
  }, [localSurvey, survey]);

  useEffect(() => {
    const warningText = t("workspace.surveys.edit.unsaved_changes_warning");
    const handleWindowClose = (e: BeforeUnloadEvent) => {
      // Skip warning if we just successfully saved
      if (isSuccessfullySavedRef.current) {
        return;
      }

      if (hasUnsavedSurveyChanges(localSurvey, [survey, lastSavedSurveyRef.current])) {
        e.preventDefault();
        return (e.returnValue = warningText);
      }
    };

    window.addEventListener("beforeunload", handleWindowClose);
    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
    };
  }, [localSurvey, survey, t]);

  const clearSurveyLocalStorage = () => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`${localSurvey.id}-columnOrder`);
      localStorage.removeItem(`${localSurvey.id}-columnVisibility`);
    }
  };

  /**
   * A missing trigger used to disable Save / Save & Close / Publish outright, which left the user
   * with a greyed-out button and no reason for it (ENG-2581). The buttons now stay clickable and the
   * click reports the problem: the trigger-required toast, plus the Survey Trigger card marked
   * invalid on the Settings tab, where it can be fixed. The rule itself is unchanged and still
   * enforced server-side.
   */
  const blockOnMissingTrigger = (targetStatus: TSurveyStatus): boolean => {
    if (!isMissingRequiredTrigger(localSurvey, targetStatus)) return false;

    toast.error(t("workspace.surveys.edit.please_set_a_survey_trigger"));
    setHasTriggerError(true);
    setActiveId("settings");
    return true;
  };

  // The server re-validates Custom CSS on every save and keeps the previous revision when it fails,
  // so this only spares the author a round trip and points them at the errors.
  const blockOnInvalidCustomCss = (): boolean => {
    if (!isCustomCssBlockingManualSave(customCssValidationStatus)) return false;

    toast.error(t("workspace.custom_css.fix_errors_before_saving"));
    setActiveId("styling");
    return true;
  };

  const isPublishScheduled = localSurvey.status === "draft" && localSurvey.publishOn !== null;
  const draftSaveLabel = isPublishScheduled ? t("common.save_without_scheduling") : t("common.save_as_draft");
  let draftPrimaryLabel = t("workspace.surveys.edit.publish");
  if (isPublishScheduled) {
    draftPrimaryLabel = t("workspace.surveys.edit.schedule_survey");
  } else if (isCxMode) {
    draftPrimaryLabel = t("workspace.surveys.edit.save_and_close");
  }

  /**
   * **What every payload below sends for Embedded Data (ENG-2628).**
   *
   * `localSurvey.embeddedFields` is the editor's Embedded Data state — the Variables and Hidden
   * Fields cards write it — and on the wire it is the COMPLETE desired set for both sources. The
   * server writes the rows from it and derives `variables` / `hiddenFields` back off those rows on
   * every read (`toLegacyEmbeddedFields`), so the two legacy keys travelling in the same payload are
   * ignored: they are forwarded exactly as they arrived at mount, and nothing here recomputes them.
   * Deriving them client-side too would give one survey two descriptions that can disagree, which is
   * the failure this ticket removed.
   *
   * There is nothing to spell out at each call site: spreading `localSurvey` carries all three keys.
   *
   * The save return does not always replace the working copy, and the dirty check is what closes
   * that gap. `handleSurveySave` / `handleSurveySaveDraft` both `setLocalSurvey(response)`, so there
   * the freshly written rows — with their `id`, `key`, `locked` and minted storage keys — land back
   * in state. The interval auto-save below deliberately does **not**: it updates its refs only, to
   * avoid re-rendering the editor while the author is typing. So the working copy legitimately keeps
   * a card-built row with no `id` and the mount-time legacy keys, and `hasUnsavedSurveyChanges`
   * normalizes all three away before comparing (`editor/lib/unsaved-changes.ts`). Without that
   * normalization a `isDeepEqual` fails on the key count alone and the auto-save never stops.
   */
  const getDraftSurveyToPersist = (draftSurvey: TSurvey, segment: TSegment | null): TSurveyDraft => ({
    ...draftSurvey,
    closeOn: draftSurvey.publishOn ? null : draftSurvey.closeOn,
    publishOn: null,
    segment,
    status: "draft",
  });

  const handleBack = () => {
    if (hasUnsavedSurveyChanges(localSurvey, [survey, lastSavedSurveyRef.current])) {
      setConfirmDialogOpen(true);
    } else {
      router.back();
    }
  };

  const handleTemporarySegment = async () => {
    if (localSurvey.segment && localSurvey.type === "app" && localSurvey.segment?.id === "temp") {
      const { filters } = localSurvey.segment;

      // create a new private segment
      const newSegment = await createSegmentAction({
        workspaceId: localSurvey.workspaceId,
        filters,
        isPrivate: true,
        surveyId: localSurvey.id,
        title: localSurvey.id,
      });

      return newSegment?.data;
    }
  };

  const handleSegmentUpdate = async (): Promise<TSegment | null> => {
    if (localSurvey.segment && localSurvey.segment.id === "temp") {
      const segment = await handleTemporarySegment();
      return segment ?? null;
    }

    return localSurvey.segment;
  };

  const validateSurveyWithZod = (): boolean => {
    const localSurveyValidation = ZSurvey.safeParse(localSurvey);
    if (!localSurveyValidation.success) {
      const issues = localSurveyValidation.error.issues;
      const newInvalidIds: string[] = [];
      // DOM id of the first invalid card so we can scroll it into view. For logic
      // errors this is the block (the red bar lives on the block card); for element
      // errors it's the element card itself.
      let firstInvalidScrollId: string | null = null;

      for (const issue of issues) {
        if (issue.path[0] === "blocks") {
          const blockIdx = issue.path[1] as number;

          if (issue.path[2] === "elements" && typeof issue.path[3] === "number") {
            const elementIdx = issue.path[3];
            const block: TSurveyBlock = localSurvey.blocks?.[blockIdx];
            const element = block?.elements[elementIdx];

            if (element && !newInvalidIds.includes(element.id)) {
              newInvalidIds.push(element.id);
            }
            firstInvalidScrollId ??= element?.id ?? null;
          } else if (issue.path[2] === "name") {
            // Empty block name: flag the block itself so its card turns red. Block ids never
            // collide with element or logic-rule ids, so this is unambiguous in invalidElements.
            const block: TSurveyBlock = localSurvey.blocks?.[blockIdx];

            if (block && !newInvalidIds.includes(block.id)) {
              newInvalidIds.push(block.id);
            }
            firstInvalidScrollId ??= block?.id ?? null;
          } else if (issue.path[2] === "logic" && typeof issue.path[3] === "number") {
            // Conditional logic error: flag the offending rule so the block card
            // surfaces it. Uses the logic rule id (a CUID, distinct from element ids).
            const logicIdx = issue.path[3];
            const block: TSurveyBlock = localSurvey.blocks?.[blockIdx];
            const logicItem = block?.logic?.[logicIdx];

            if (logicItem && !newInvalidIds.includes(logicItem.id)) {
              newInvalidIds.push(logicItem.id);
            }
            firstInvalidScrollId ??= block?.id ?? null;
          } else if (issue.path[2] === "logic") {
            // Block-scope logic error (e.g. a cyclic jump) with no specific rule index: flag every
            // rule in the block so the Conditional Logic section still surfaces and auto-expands.
            const block: TSurveyBlock = localSurvey.blocks?.[blockIdx];
            for (const logicItem of block?.logic ?? []) {
              if (!newInvalidIds.includes(logicItem.id)) {
                newInvalidIds.push(logicItem.id);
              }
            }
            firstInvalidScrollId ??= block?.id ?? null;
          }
        } else if (issue.path[0] === "welcomeCard") {
          if (!newInvalidIds.includes("start")) {
            newInvalidIds.push("start");
          }
          firstInvalidScrollId ??= "start";
        } else if (issue.path[0] === "endings") {
          const endingIdx = typeof issue.path[1] === "number" ? issue.path[1] : -1;
          const endingId = localSurvey.endings[endingIdx]?.id;
          if (endingId && !newInvalidIds.includes(endingId)) {
            newInvalidIds.push(endingId);
          }
          firstInvalidScrollId ??= endingId ?? null;
        }
      }

      if (newInvalidIds.length > 0) {
        setInvalidElements((prev) => {
          const existing = prev ?? [];
          const merged = [...existing];
          for (const id of newInvalidIds) {
            if (!merged.includes(id)) {
              merged.push(id);
            }
          }
          return merged;
        });
      }

      if (firstInvalidScrollId) {
        scrollElementCardIntoView(firstInvalidScrollId, "start");
      }

      const firstError = issues[0];

      // The schema can only say "Block name is required"; it has no idea which block. Name it,
      // so the message matches the card that just turned red.
      if (firstError.path[0] === "blocks" && firstError.path[2] === "name") {
        toast.error(
          t("workspace.surveys.edit.block_name_required_for", {
            blockNumber: (firstError.path[1] as number) + 1,
          })
        );
        return false;
      }

      const logicDestinationMessage = getLogicDestinationErrorMessage(firstError, localSurvey.blocks, t);
      if (logicDestinationMessage) {
        toast.error(logicDestinationMessage, { className: "w-fit max-w-md!" });
        return false;
      }

      if (firstError.code === "custom") {
        const params = firstError.params ?? ({} as { invalidLanguageCodes: string[] });
        if (params.invalidLanguageCodes && params.invalidLanguageCodes.length) {
          const invalidLanguageLabels = params.invalidLanguageCodes.map(
            (invalidLanguage: string) => getLanguageLabel(invalidLanguage, locale) ?? invalidLanguage
          );

          const messageSplit = firstError.message.split("-fLang-")[0];

          toast.error(`${messageSplit} ${invalidLanguageLabels.join(", ")}`);
          setActiveId("language");
        } else {
          toast.error(firstError.message, {
            className: "w-fit max-w-md!",
          });
        }

        return false;
      }

      // Anything else reaches here with a raw Zod default ("Invalid input", "Invalid input: expected
      // string, received undefined") that names no field. The issue path does, so build the message from it.
      const elementIssue = describeElementIssue(firstError, t, locale);

      if (elementIssue) {
        toast.error(elementIssue.message, { className: "w-fit max-w-md!" });
        if (elementIssue.languageCode && elementIssue.languageCode !== "default") {
          setActiveId("language");
        }
        return false;
      }

      toast.error(firstError.message);
      return false;
    }

    return true;
  };

  // Interval-based auto-save for draft surveys (every 10 seconds)
  useEffect(() => {
    // Only set up interval for draft surveys
    if (localSurvey.status !== "draft" || localSurvey.publishOn !== null) return;

    const intervalId = setInterval(async () => {
      // Skip if tab is not visible (no computation, no API calls for background tabs)
      if (document.hidden) return;

      // Skip if already saving, publishing, or auto-saving
      if (isAutoSavingRef.current || isSurveySavingRef.current || isSurveyPublishingRef.current) return;

      // A Custom CSS draft goes out only once its check has passed; until then the saved CSS stands in
      // for it, so an unchecked or invalid draft cannot fail the survey's other edits.
      const currentSurvey = getSurveyToAutosave(
        localSurveyRef.current,
        lastSavedSurveyRef.current ?? surveyRef.current,
        customCssValidationStatusRef.current
      );

      // Check for changes using refs (avoids re-creating interval on every change), and skip if
      // there are none
      if (!hasUnsavedSurveyChanges(currentSurvey, [surveyRef.current, lastSavedSurveyRef.current])) {
        // Nothing is waiting to be saved, so nothing is lost either -- e.g. the author reverted the
        // edit a failed tick was carrying. (A no-op when the flag is already clear.)
        setAutoSaveFailure(null);
        return;
      }

      isAutoSavingRef.current = true;
      const attempt = saveAttemptOrder.begin();

      try {
        const updatedSurveyResponse = await updateSurveyDraftAction({
          ...currentSurvey,
          segment: currentSurvey.segment?.id === "temp" ? null : currentSurvey.segment,
        } as unknown as TSurveyDraft);

        if (updatedSurveyResponse?.data) {
          const savedData = updatedSurveyResponse.data;

          // The server deletes a private segment when a survey switches from app to link, so the
          // working copy has to take that back. Skipping it is not a cosmetic loss: the stale id
          // goes back out on the next save, `assertSurveySegmentBelongsToWorkspace` throws
          // `ResourceNotFoundError`, and the catch below swallows it — so this block never runs
          // again and the editor cannot be saved or published until the page is reloaded.
          //
          // Through the updater rather than against `localSurveyRef` (ENG-3266), which is written in
          // a passive effect and so still names the sent object for as long as it takes React to
          // flush one — a window the response can land in, where the ref would overwrite whatever
          // the author changed mid-flight. `current` is the state itself, so the spread carries
          // those edits and replaces only the key the server owns.
          //
          // The one edit the spread could still lose is an edit to `segment` itself: `TargetingCard`
          // writes it on every change and is mounted for app surveys, so an author refining their
          // targeting while a tick is in flight would get `savedData.segment` — the segment as it
          // was when the request went out — written back over the newer one. So the guard is on
          // `segment` alone, against the value the working copy held when it was sent. Guarding on
          // the survey's object identity instead settles the same race by abandoning the adoption
          // after any unrelated keystroke, which is what left the editor unsaveable.
          //
          // `currentSurvey.segment` rather than what was serialized: a `temp` segment goes out as
          // `null`, and comparing against the wire value would read that rewrite as an author edit
          // and never adopt the real segment the server answers with.
          //
          // The Embedded Data keys need no such adoption: `hasUnsavedSurveyChanges` normalizes them
          // on both sides, which settles the dirty check without re-rendering the editor at all.
          setLocalSurvey((current) => {
            if (!isDeepEqual(current.segment, currentSurvey.segment)) return current;
            if (isDeepEqual(current.segment, savedData.segment)) return current;
            return { ...current, segment: savedData.segment };
          });

          // Update surveyRef (not localSurvey state) to prevent re-renders during auto-save.
          // This keeps the UI stable while still tracking that changes have been saved.
          // The comparison uses refs, so this prevents unnecessary re-saves.
          surveyRef.current = { ...savedData };
          lastSavedSurveyRef.current = structuredClone(savedData);
          isSuccessfullySavedRef.current = true;
          // The refs above follow what the server stored either way; the indicator only follows the
          // newest attempt, so a tick that lands after a newer save failed does not say "saved".
          if (saveAttemptOrder.settle(attempt)) {
            setAutoSaveFailure(null);
            setLastAutoSaved(new Date());
          }
        } else if (saveAttemptOrder.settle(attempt)) {
          // The request reached the app and the save was refused (`serverError`, validation, a missing
          // segment) -- just as unsaved as a failed request.
          setAutoSaveFailure("retrying");
        }
      } catch (e) {
        // A stale bundle's action id is rejected by the new deployment: hand it to the reload
        // prompt rather than failing this tick silently, and stop the interval -- nothing this
        // bundle sends is accepted until the tab reloads, so retrying every 10s only burns
        // requests behind a prompt that is already up.
        if (reportStaleServerActionError(e)) {
          clearInterval(intervalId);
          // The edit this tick carried is not saved, and nothing will retry it: say so, without the
          // "keeps trying" promise the retrying state makes.
          setAutoSaveFailure("stopped");
          return;
        }
        // Anything else means this tick's save did not land -- a load balancer error page, a dropped
        // connection. Nothing reaches `unhandledrejection` from here, so the indicator is the only
        // place the author can learn about it.
        console.error(e);
        if (saveAttemptOrder.settle(attempt)) setAutoSaveFailure("retrying");
      } finally {
        isAutoSavingRef.current = false;
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [localSurvey.publishOn, localSurvey.status, saveAttemptOrder, setLocalSurvey]);

  // Add new handler after handleSurveySave
  const handleSurveySaveDraft = async (): Promise<boolean> => {
    if (blockOnInvalidCustomCss()) return false;

    setIsSurveySaving(true);
    const attempt = saveAttemptOrder.begin();

    try {
      const segment = await handleSegmentUpdate();
      clearSurveyLocalStorage();
      const updatedSurveyResponse = await updateSurveyDraftAction(
        getDraftSurveyToPersist(localSurvey, segment)
      );

      setIsSurveySaving(false);
      if (updatedSurveyResponse?.data) {
        setLocalSurvey(updatedSurveyResponse.data);
        lastSavedSurveyRef.current = structuredClone(updatedSurveyResponse.data);
        toast.success(t("workspace.surveys.edit.changes_saved"));
        isSuccessfullySavedRef.current = true;
        if (saveAttemptOrder.settle(attempt)) setAutoSaveFailure(null);
        router.refresh();
      } else {
        // Recorded so an older tick that lands afterwards cannot report this draft as saved.
        saveAttemptOrder.settle(attempt);
        const errorMessage = getFormattedErrorMessage(updatedSurveyResponse);
        toast.error(errorMessage);
        return false;
      }
      return true;
    } catch (e) {
      setIsSurveySaving(false);
      saveAttemptOrder.settle(attempt);
      // The reload prompt already explains a stale-deployment failure, so don't also claim the
      // save itself went wrong.
      if (reportStaleServerActionError(e)) {
        return false;
      }
      console.error(e);
      toast.error(t("workspace.surveys.edit.error_saving_changes"));
      return false;
    }
  };

  const handleSurveySave = async (): Promise<boolean> => {
    // Ahead of the spinner: a click that cannot go through should report why, not appear to work.
    if (blockOnMissingTrigger(localSurvey.status)) return false;
    if (blockOnInvalidCustomCss()) return false;

    setIsSurveySaving(true);
    // Begun only once the request is about to go out: a save stopped by validation never raced anything.
    let attempt: number | undefined;

    const isSurveyValidatedWithZod = validateSurveyWithZod();

    if (!isSurveyValidatedWithZod) {
      setIsSurveySaving(false);
      return false;
    }

    try {
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode, t, finishedResponseCount);
      if (!isSurveyValidResult) {
        setIsSurveySaving(false);
        return false;
      }

      // Clean up blocks by removing isDraft from elements
      if (localSurvey.blocks) {
        localSurvey.blocks = localSurvey.blocks.map((block) => ({
          ...block,
          elements: block.elements.map((element) => {
            const { isDraft, ...rest } = element;
            return rest;
          }),
        }));
      }

      // Set questions to empty array for blocks-based surveys
      localSurvey.questions = [];

      localSurvey.endings = localSurvey.endings.map((ending) => {
        if (ending.type === "redirectToUrl") {
          return ZSurveyRedirectUrlCard.parse(ending);
        } else {
          return ZSurveyEndScreenCard.parse(ending);
        }
      });

      attempt = saveAttemptOrder.begin();
      const segment = await handleSegmentUpdate();
      clearSurveyLocalStorage();
      const updatedSurveyResponse = await updateSurveyAction({ ...localSurvey, segment });

      setIsSurveySaving(false);
      if (updatedSurveyResponse?.data) {
        // isSecondPublish is a transient action flag, not part of the survey — strip it so it
        // doesn't linger in editor state and get echoed back on the next update.
        const { isSecondPublish: _isSecondPublish, ...updatedSurvey } = updatedSurveyResponse.data;
        setLocalSurvey(updatedSurvey);
        lastSavedSurveyRef.current = structuredClone(updatedSurvey);
        toast.success(t("workspace.surveys.edit.changes_saved"));
        // Set flag to prevent beforeunload warning during router.refresh()
        isSuccessfullySavedRef.current = true;
        if (saveAttemptOrder.settle(attempt)) setAutoSaveFailure(null);
        router.refresh();
      } else {
        saveAttemptOrder.settle(attempt);
        const errorMessage = getFormattedErrorMessage(updatedSurveyResponse);
        toast.error(errorMessage);
        return false;
      }

      return true;
    } catch (e) {
      setIsSurveySaving(false);
      if (attempt !== undefined) saveAttemptOrder.settle(attempt);
      if (reportStaleServerActionError(e)) {
        return false;
      }
      console.error(e);
      toast.error(t("workspace.surveys.edit.error_saving_changes"));
      return false;
    }
  };

  const handleSaveAndGoBack = async () => {
    const isSurveySaved =
      localSurvey.status === "draft" ? await handleSurveySaveDraft() : await handleSurveySave();
    if (isSurveySaved) {
      // Navigate explicitly rather than router.back(): the editor is often reached without an
      // in-app history entry behind it (new tab, pasted/bookmarked URL, hard reload), and back()
      // silently no-ops there — the survey saves but the editor never closes. The publish path
      // already navigates to the summary this way.
      //
      // Both branches navigate, but not to the same place, because the two callers arrive here from
      // different pages. The "Save & Close" button renders only for a non-draft, and its editor is
      // reached from the summary. A draft gets here only through the unsaved-changes dialog, opened
      // by the back arrow, and its editor is reached from the survey list — the list deliberately
      // never links a draft to /summary (see `linkHref` in `survey/list/components/survey-card.tsx`),
      // since a draft has no responses to summarise. So a draft closes to the list.
      router.push(
        localSurvey.status === "draft"
          ? `${workspaceBasePath}/surveys`
          : `${workspaceBasePath}/surveys/${localSurvey.id}/summary`
      );
    }
  };

  const handleSurveyPublish = async () => {
    if (blockOnMissingTrigger("inProgress")) return;
    if (blockOnInvalidCustomCss()) return;

    isSurveyPublishingRef.current = true;
    setIsSurveyPublishing(true);

    const isSurveyValidatedWithZod = validateSurveyWithZod();

    if (!isSurveyValidatedWithZod) {
      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
      return;
    }

    try {
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode, t, finishedResponseCount);
      if (!isSurveyValidResult) {
        isSurveyPublishingRef.current = false;
        setIsSurveyPublishing(false);
        return;
      }
      const status = "inProgress";
      const segment = await handleSegmentUpdate();
      clearSurveyLocalStorage();

      const publishResult = await updateSurveyAction({
        ...localSurvey,
        status,
        segment,
      });

      if (!publishResult?.data) {
        const errorMessage = getFormattedErrorMessage(publishResult);
        toast.error(errorMessage);
        isSurveyPublishingRef.current = false;
        setIsSurveyPublishing(false);
        return;
      }

      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);

      // When the user publishes their second survey, fire an in-app code action so a
      // Formbricks survey can be triggered from the dashboard. The flag is computed
      // server-side in updateSurveyAction, so there's no extra round-trip here.
      if (publishResult.data.isSecondPublish) {
        formbricks.track("second_survey_published").catch(() => undefined);
      }

      // Set flag to prevent beforeunload warning during navigation
      isSuccessfullySavedRef.current = true;
      router.push(`${workspaceBasePath}/surveys/${localSurvey.id}/summary?success=true`);
    } catch (error) {
      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
      if (reportStaleServerActionError(error)) {
        return;
      }
      console.error(error);
      toast.error(t("workspace.surveys.edit.error_publishing_survey"));
    }
  };

  const handleSurveySchedule = async () => {
    // Scheduling lands on "paused", which is live enough to need a trigger.
    if (blockOnMissingTrigger("paused")) return;
    if (blockOnInvalidCustomCss()) return;

    isSurveyPublishingRef.current = true;
    setIsSurveyPublishing(true);

    const isSurveyValidatedWithZod = validateSurveyWithZod();

    if (!isSurveyValidatedWithZod) {
      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
      return;
    }

    try {
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode, t, finishedResponseCount);
      if (!isSurveyValidResult) {
        isSurveyPublishingRef.current = false;
        setIsSurveyPublishing(false);
        return;
      }
      const status = "paused";
      const segment = await handleSegmentUpdate();
      clearSurveyLocalStorage();

      const scheduleResult = await updateSurveyAction({
        ...localSurvey,
        status,
        segment,
      });

      if (!scheduleResult?.data) {
        const errorMessage = getFormattedErrorMessage(scheduleResult);
        toast.error(errorMessage);
        isSurveyPublishingRef.current = false;
        setIsSurveyPublishing(false);
        return;
      }

      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
      isSuccessfullySavedRef.current = true;
      router.push(`${workspaceBasePath}/surveys/${localSurvey.id}/summary?scheduled=true`);
    } catch (error) {
      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
      if (reportStaleServerActionError(error)) {
        return;
      }
      console.error(error);
      toast.error(t("workspace.surveys.edit.error_publishing_survey"));
    }
  };

  const runActivation = () => (isPublishScheduled ? handleSurveySchedule() : handleSurveyPublish());

  // The same checks the activate path runs, done up front so the dialog never opens for a survey
  // that could not be activated anyway.
  const isReadyToActivate = (): boolean => {
    if (blockOnMissingTrigger(isPublishScheduled ? "paused" : "inProgress")) return false;
    if (blockOnInvalidCustomCss()) return false;
    if (!validateSurveyWithZod()) return false;
    return isSurveyValid(localSurvey, selectedLanguageCode, t, finishedResponseCount);
  };

  const handleActivateClick = () => {
    if (
      !shouldAskWhoCanView({ gate: visibilityGate, access: surveyAccess, visibility: effectiveVisibility })
    ) {
      void runActivation();
      return;
    }
    if (isReadyToActivate()) setIsActivateDialogOpen(true);
  };

  const makeVisibleForActivation = async (choice: TSurveyVisibility): Promise<TActivationStep> => {
    setIsChangingVisibility(true);
    try {
      await updateSurveyVisibility.mutateAsync({
        surveyId: localSurvey.id,
        visibility: "workspace",
      });
      onVisibilityChanged();
      return planActivation(choice, { ok: true });
    } catch (error) {
      const step = planActivation(choice, { ok: false, error });
      if (step.kind === "activate") {
        // The grant is stored but not in effect yet: the survey stays restricted until it settles.
        onVisibilityChanged();
      } else {
        toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      }
      return step;
    } finally {
      setIsChangingVisibility(false);
    }
  };

  const handleActivateConfirm = async (choice: TSurveyVisibility) => {
    let step = planActivation(choice);
    if (step.kind === "change_visibility") step = await makeVisibleForActivation(choice);

    if (step.kind === "abort") {
      if (step.hideControls) handleVisibilityNotEnabled();
      return;
    }
    if (step.kind === "activate" && step.pending) {
      toast.success(t("workspace.surveys.visibility.visibility_update_pending"));
    }
    setIsActivateDialogOpen(false);
    await runActivation();
  };

  return (
    <div className="border-b border-slate-200 bg-white px-5 py-2.5 sm:flex sm:items-center sm:justify-between">
      <div className="flex h-full items-center gap-x-2 whitespace-nowrap">
        {!isCxMode && (
          <Button
            size="sm"
            variant="secondary"
            className="h-full"
            onClick={() => {
              handleBack();
            }}>
            <ArrowLeftIcon />
            {t("common.back")}
          </Button>
        )}
        <p className="hidden pl-4 font-semibold md:block">{workspace.name} / </p>
        <Input
          defaultValue={localSurvey.name}
          onChange={(e) => {
            const updatedSurvey = { ...localSurvey, name: e.target.value };
            setLocalSurvey(updatedSurvey);
          }}
          // With Collaborate next to it, the input is sized to the name (so the button sits right after
          // it) and widens while editing; browsers without field-sizing keep the input's default width.
          className={
            canManageVisibility
              ? "field-sizing-content h-8 w-auto max-w-72 min-w-16 border-white py-0 hover:border-slate-200 focus:max-w-md focus:min-w-72"
              : "h-8 w-72 border-white py-0 hover:border-slate-200"
          }
          aria-label={t("workspace.surveys.rename_survey_placeholder")}
        />
        {canManageVisibility && (
          <Button size="sm" variant="secondary" onClick={() => setIsCollaborateModalOpen(true)}>
            <UsersIcon />
            {t("common.collaborate")}
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 sm:mt-0 sm:ml-4">
        <AutoSaveIndicator
          isDraft={localSurvey.status === "draft"}
          // Scheduled drafts are not auto-saved (the interval is torn down), so the badge says paused.
          isScheduled={isPublishScheduled}
          lastSaved={lastAutoSaved}
          failure={autoSaveFailure}
          // CX mode hides the manual save, so the badge must not suggest one.
          canSaveManually={!isCxMode}
        />
        {!isStorageConfigured && (
          <div>
            <Alert variant="warning" size="small" role="status">
              <AlertTitle>{t("common.storage_not_configured")}</AlertTitle>
              <AlertButton className="flex items-center justify-center">
                <a
                  className="flex h-full w-full items-center justify-center bg-white!"
                  href="https://formbricks.com/docs/self-hosting/configuration/file-uploads"
                  target="_blank"
                  rel="noopener noreferrer">
                  <span>{t("common.learn_more")}</span>
                </a>
              </AlertButton>
            </Alert>
          </div>
        )}
        {responseCount > 0 && (
          <div>
            <Alert variant="warning" size="small" role="status">
              <AlertTitle>{t("workspace.surveys.edit.caution_text")}</AlertTitle>
              <AlertButton onClick={() => setIsCautionDialogOpen(true)}>{t("common.learn_more")}</AlertButton>
            </Alert>
          </div>
        )}
        {!isCxMode && (
          <Button
            data-save-button
            disabled={isSurveySaving}
            variant="secondary"
            size="sm"
            loading={isSurveySaving}
            onClick={() => (localSurvey.status === "draft" ? handleSurveySaveDraft() : handleSurveySave())}
            type="submit">
            {localSurvey.status === "draft" ? draftSaveLabel : t("common.save")}
          </Button>
        )}
        {localSurvey.status !== "draft" && (
          <Button
            disabled={isSurveySaving}
            className="mr-3"
            size="sm"
            loading={isSurveySaving}
            onClick={() => handleSaveAndGoBack()}>
            {t("workspace.surveys.edit.save_and_close")}
          </Button>
        )}
        {localSurvey.status === "draft" && audiencePrompt && !isLinkSurvey && (
          <Button
            size="sm"
            onClick={() => {
              setAudiencePrompt(false);
              setActiveId("settings");
            }}>
            {t("workspace.surveys.edit.continue_to_settings")}
            <SettingsIcon />
          </Button>
        )}
        {/* Always display Publish button for link surveys for better CR */}
        {localSurvey.status === "draft" && (!audiencePrompt || isLinkSurvey) && (
          <Button
            size="sm"
            disabled={isSurveySaving}
            loading={isSurveyPublishing}
            onClick={handleActivateClick}>
            {draftPrimaryLabel}
          </Button>
        )}
      </div>
      <AlertDialog
        headerText={t("workspace.surveys.edit.confirm_survey_changes")}
        open={isConfirmDialogOpen}
        setOpen={setConfirmDialogOpen}
        mainText={t("workspace.surveys.edit.unsaved_changes_warning")}
        confirmBtnLabel={localSurvey.status === "draft" ? draftSaveLabel : t("common.save")}
        declineBtnLabel={t("common.discard")}
        declineBtnVariant="destructive"
        onDecline={() => {
          setConfirmDialogOpen(false);
          router.back();
        }}
        onConfirm={handleSaveAndGoBack}
      />
      {canManageVisibility && (
        <>
          <CollaborateModal
            open={isCollaborateModalOpen}
            setOpen={setIsCollaborateModalOpen}
            surveyId={localSurvey.id}
            workspaceName={workspace.name}
            onVisibilityChanged={onVisibilityChanged}
            onVisibilityNotEnabled={handleVisibilityNotEnabled}
          />
          <ActivateDialog
            open={isActivateDialogOpen}
            setOpen={setIsActivateDialogOpen}
            workspaceName={workspace.name}
            author={restrictedAuthor}
            isScheduling={isPublishScheduled}
            isSubmitting={isChangingVisibility || isSurveyPublishing}
            onConfirm={(choice) => void handleActivateConfirm(choice)}
          />
        </>
      )}
    </div>
  );
};
