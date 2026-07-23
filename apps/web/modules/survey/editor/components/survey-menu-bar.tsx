"use client";

import { ArrowLeftIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import formbricks from "@formbricks/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  TSurvey,
  TSurveyEditorTabs,
  ZSurvey,
  ZSurveyEndScreenCard,
  ZSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { isDeepEqual } from "@/lib/utils/object";
import { createSegmentAction } from "@/modules/ee/contacts/segments/actions";
import { scrollElementCardIntoView } from "@/modules/survey/editor/lib/utils";
import { TSurveyDraft } from "@/modules/survey/editor/types/survey";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { updateSurveyAction, updateSurveyDraftAction } from "../actions";
import { isSurveyValid } from "../lib/validation";
import { AutoSaveIndicator } from "./auto-save-indicator";

interface SurveyMenuBarProps {
  localSurvey: TSurvey;
  survey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeId: TSurveyEditorTabs;
  setActiveId: React.Dispatch<React.SetStateAction<TSurveyEditorTabs>>;
  setInvalidElements: React.Dispatch<React.SetStateAction<string[] | null>>;
  workspace: Workspace;
  responseCount: number;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (selectedLanguage: string) => void;
  isCxMode: boolean;
  locale: string;
  setIsCautionDialogOpen: (open: boolean) => void;
  isStorageConfigured: boolean;
}

export const SurveyMenuBar = ({
  localSurvey,
  survey,
  setLocalSurvey,
  activeId,
  setActiveId,
  setInvalidElements,
  workspace,
  responseCount,
  selectedLanguageCode,
  isCxMode,
  locale,
  setIsCautionDialogOpen,
  isStorageConfigured = true,
}: SurveyMenuBarProps) => {
  const workspaceBasePath = `/workspaces/${workspace.id}`;
  const { t } = useTranslation();
  const router = useRouter();
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isLinkSurvey, setIsLinkSurvey] = useState(true);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSurveyPublishing, setIsSurveyPublishing] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const isSuccessfullySavedRef = useRef(false);
  const isAutoSavingRef = useRef(false);
  const isSurveyPublishingRef = useRef(false);

  // Refs for interval-based auto-save (to access current values without re-creating interval)
  const localSurveyRef = useRef(localSurvey);
  const surveyRef = useRef(survey);
  const isSurveySavingRef = useRef(isSurveySaving);

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

  useEffect(() => {
    isSurveySavingRef.current = isSurveySaving;
  }, [isSurveySaving]);

  // Reset the successfully saved flag when survey prop updates (page refresh complete)
  useEffect(() => {
    if (isSuccessfullySavedRef.current) {
      isSuccessfullySavedRef.current = false;
    }
  }, [survey]);

  useEffect(() => {
    const warningText = t("workspace.surveys.edit.unsaved_changes_warning");
    const handleWindowClose = (e: BeforeUnloadEvent) => {
      // Skip warning if we just successfully saved
      if (isSuccessfullySavedRef.current) {
        return;
      }

      if (!isDeepEqual(localSurvey, survey)) {
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

  const containsEmptyTriggers = useMemo(() => {
    if (localSurvey.type === "link") return false;

    const noTriggers = !localSurvey.triggers || localSurvey.triggers.length === 0 || !localSurvey.triggers[0];

    if (noTriggers) return true;

    return false;
  }, [localSurvey]);

  const disableSave = useMemo(() => {
    if (isSurveySaving) return true;

    if (localSurvey.status !== "draft" && containsEmptyTriggers) return true;
  }, [containsEmptyTriggers, isSurveySaving, localSurvey.status]);
  const isPublishScheduled = localSurvey.status === "draft" && localSurvey.publishOn !== null;
  const draftSaveLabel = isPublishScheduled ? t("common.save_without_scheduling") : t("common.save_as_draft");
  let draftPrimaryLabel = t("workspace.surveys.edit.publish");
  if (isPublishScheduled) {
    draftPrimaryLabel = t("workspace.surveys.edit.schedule_survey");
  } else if (isCxMode) {
    draftPrimaryLabel = t("workspace.surveys.edit.save_and_close");
  }

  const getDraftSurveyToPersist = (draftSurvey: TSurvey, segment: TSegment | null): TSurveyDraft => ({
    ...draftSurvey,
    closeOn: draftSurvey.publishOn ? null : draftSurvey.closeOn,
    publishOn: null,
    segment,
    status: "draft",
  });

  const handleBack = () => {
    const { updatedAt, ...localSurveyRest } = localSurvey;
    const { updatedAt: _, ...surveyRest } = survey;

    if (!isDeepEqual(localSurveyRest, surveyRest)) {
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

      // Check for changes using refs (avoids re-creating interval on every change)
      const { updatedAt: localUpdatedAt, ...localSurveyRest } = localSurveyRef.current;
      const { updatedAt: surveyUpdatedAt, ...surveyRest } = surveyRef.current;

      // Skip if no changes
      if (isDeepEqual(localSurveyRest, surveyRest)) return;

      isAutoSavingRef.current = true;

      try {
        const currentSurvey = localSurveyRef.current;
        const updatedSurveyResponse = await updateSurveyDraftAction({
          ...currentSurvey,
          segment: currentSurvey.segment?.id === "temp" ? null : currentSurvey.segment,
        } as unknown as TSurveyDraft);

        if (updatedSurveyResponse?.data) {
          const savedData = updatedSurveyResponse.data;

          // If the segment changed on the server (e.g., private segment was deleted when
          // switching from app to link type), update localSurvey to prevent stale segment
          // references when publishing
          if (!isDeepEqual(localSurveyRef.current.segment, savedData.segment)) {
            setLocalSurvey({ ...localSurveyRef.current, segment: savedData.segment });
          }

          // Update surveyRef (not localSurvey state) to prevent re-renders during auto-save.
          // This keeps the UI stable while still tracking that changes have been saved.
          // The comparison uses refs, so this prevents unnecessary re-saves.
          surveyRef.current = { ...savedData };
          isSuccessfullySavedRef.current = true;
          setLastAutoSaved(new Date());
        }
      } catch (e) {
        console.error(e);
      } finally {
        isAutoSavingRef.current = false;
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [localSurvey.publishOn, localSurvey.status, setLocalSurvey]);

  // Add new handler after handleSurveySave
  const handleSurveySaveDraft = async (): Promise<boolean> => {
    setIsSurveySaving(true);

    try {
      const segment = await handleSegmentUpdate();
      clearSurveyLocalStorage();
      const updatedSurveyResponse = await updateSurveyDraftAction(
        getDraftSurveyToPersist(localSurvey, segment)
      );

      setIsSurveySaving(false);
      if (updatedSurveyResponse?.data) {
        setLocalSurvey(updatedSurveyResponse.data);
        toast.success(t("workspace.surveys.edit.changes_saved"));
        isSuccessfullySavedRef.current = true;
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(updatedSurveyResponse);
        toast.error(errorMessage);
        return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      setIsSurveySaving(false);
      toast.error(t("workspace.surveys.edit.error_saving_changes"));
      return false;
    }
  };

  const handleSurveySave = async (): Promise<boolean> => {
    setIsSurveySaving(true);

    const isSurveyValidatedWithZod = validateSurveyWithZod();

    if (!isSurveyValidatedWithZod) {
      setIsSurveySaving(false);
      return false;
    }

    try {
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode, t, responseCount);
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

      if (localSurvey.type !== "link" && !localSurvey.triggers?.length) {
        toast.error(t("workspace.surveys.edit.please_set_a_survey_trigger"));
        setIsSurveySaving(false);
        return false;
      }

      const segment = await handleSegmentUpdate();
      clearSurveyLocalStorage();
      const updatedSurveyResponse = await updateSurveyAction({ ...localSurvey, segment });

      setIsSurveySaving(false);
      if (updatedSurveyResponse?.data) {
        // isSecondPublish is a transient action flag, not part of the survey — strip it so it
        // doesn't linger in editor state and get echoed back on the next update.
        const { isSecondPublish: _isSecondPublish, ...updatedSurvey } = updatedSurveyResponse.data;
        setLocalSurvey(updatedSurvey);
        toast.success(t("workspace.surveys.edit.changes_saved"));
        // Set flag to prevent beforeunload warning during router.refresh()
        isSuccessfullySavedRef.current = true;
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(updatedSurveyResponse);
        toast.error(errorMessage);
        return false;
      }

      return true;
    } catch (e) {
      console.error(e);
      setIsSurveySaving(false);
      toast.error(t("workspace.surveys.edit.error_saving_changes"));
      return false;
    }
  };

  const handleSaveAndGoBack = async () => {
    const isSurveySaved =
      localSurvey.status === "draft" ? await handleSurveySaveDraft() : await handleSurveySave();
    if (isSurveySaved) {
      router.back();
    }
  };

  const handleSurveyPublish = async () => {
    isSurveyPublishingRef.current = true;
    setIsSurveyPublishing(true);

    const isSurveyValidatedWithZod = validateSurveyWithZod();

    if (!isSurveyValidatedWithZod) {
      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
      return;
    }

    try {
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode, t, responseCount);
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
      console.error(error);
      toast.error(t("workspace.surveys.edit.error_publishing_survey"));
      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
    }
  };

  const handleSurveySchedule = async () => {
    isSurveyPublishingRef.current = true;
    setIsSurveyPublishing(true);

    const isSurveyValidatedWithZod = validateSurveyWithZod();

    if (!isSurveyValidatedWithZod) {
      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
      return;
    }

    try {
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode, t, responseCount);
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
      console.error(error);
      toast.error(t("workspace.surveys.edit.error_publishing_survey"));
      isSurveyPublishingRef.current = false;
      setIsSurveyPublishing(false);
    }
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
          className="h-8 w-72 border-white py-0 hover:border-slate-200"
        />
      </div>

      <div className="mt-3 flex items-center gap-2 sm:mt-0 sm:ml-4">
        <AutoSaveIndicator isDraft={localSurvey.status === "draft"} lastSaved={lastAutoSaved} />
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
            disabled={disableSave}
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
            disabled={disableSave}
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
            disabled={isSurveySaving || containsEmptyTriggers}
            loading={isSurveyPublishing}
            onClick={isPublishScheduled ? handleSurveySchedule : handleSurveyPublish}>
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
    </div>
  );
};
