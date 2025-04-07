"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createSegmentAction } from "@/modules/ee/contacts/segments/actions";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { isEqual } from "lodash";
import { AlertTriangleIcon, ArrowLeftIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import { TSegment } from "@formbricks/types/segment";
import {
  TSurvey,
  TSurveyEditorTabs,
  TSurveyQuestion,
  ZSurvey,
  ZSurveyEndScreenCard,
  ZSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { updateSurveyAction } from "../actions";
import { isSurveyValid } from "../lib/validation";

interface SurveyMenuBarProps {
  localSurvey: TSurvey;
  survey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  environmentId: string;
  activeId: TSurveyEditorTabs;
  setActiveId: React.Dispatch<React.SetStateAction<TSurveyEditorTabs>>;
  setInvalidQuestions: React.Dispatch<React.SetStateAction<string[]>>;
  project: Project;
  responseCount: number;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (selectedLanguage: string) => void;
  isCxMode: boolean;
  locale: string;
}

export const SurveyMenuBar = ({
  localSurvey,
  survey,
  environmentId,
  setLocalSurvey,
  activeId,
  setActiveId,
  setInvalidQuestions,
  project,
  responseCount,
  selectedLanguageCode,
  isCxMode,
  locale,
}: SurveyMenuBarProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isLinkSurvey, setIsLinkSurvey] = useState(true);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSurveyPublishing, setIsSurveyPublishing] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const cautionText = t("environments.surveys.edit.caution_text");

  useEffect(() => {
    if (audiencePrompt && activeId === "settings") {
      setAudiencePrompt(false);
    }
  }, [activeId, audiencePrompt]);

  useEffect(() => {
    setIsLinkSurvey(localSurvey.type === "link");
  }, [localSurvey.type]);

  useEffect(() => {
    const warningText = t("environments.surveys.edit.unsaved_changes_warning");
    const handleWindowClose = (e: BeforeUnloadEvent) => {
      if (!isEqual(localSurvey, survey)) {
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

  const handleBack = () => {
    const { updatedAt, ...localSurveyRest } = localSurvey;
    const { updatedAt: _, ...surveyRest } = survey;

    if (!isEqual(localSurveyRest, surveyRest)) {
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
        environmentId: localSurvey.environmentId,
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
      const currentError = localSurveyValidation.error.errors[0];

      if (currentError.path[0] === "questions") {
        const questionIdx = currentError.path[1];
        const question: TSurveyQuestion = localSurvey.questions[questionIdx];
        if (question) {
          setInvalidQuestions((prevInvalidQuestions) =>
            prevInvalidQuestions ? [...prevInvalidQuestions, question.id] : [question.id]
          );
        }
      } else if (currentError.path[0] === "welcomeCard") {
        setInvalidQuestions((prevInvalidQuestions) =>
          prevInvalidQuestions ? [...prevInvalidQuestions, "start"] : ["start"]
        );
      } else if (currentError.path[0] === "endings") {
        const endingIdx = typeof currentError.path[1] === "number" ? currentError.path[1] : -1;
        setInvalidQuestions((prevInvalidQuestions) =>
          prevInvalidQuestions
            ? [...prevInvalidQuestions, localSurvey.endings[endingIdx].id]
            : [localSurvey.endings[endingIdx].id]
        );
      }

      if (currentError.code === "custom") {
        const params = currentError.params ?? ({} as { invalidLanguageCodes: string[] });
        if (params.invalidLanguageCodes && params.invalidLanguageCodes.length) {
          const invalidLanguageLabels = params.invalidLanguageCodes.map(
            (invalidLanguage: string) => getLanguageLabel(invalidLanguage, locale) ?? invalidLanguage
          );

          const messageSplit = currentError.message.split("-fLang-")[0];

          toast.error(`${messageSplit} ${invalidLanguageLabels.join(", ")}`);
        } else {
          toast.error(currentError.message, {
            className: "w-fit max-w-md!",
          });
        }

        return false;
      }

      toast.error(currentError.message);
      return false;
    }

    return true;
  };

  const handleSurveySave = async (): Promise<boolean> => {
    setIsSurveySaving(true);

    const isSurveyValidatedWithZod = validateSurveyWithZod();

    if (!isSurveyValidatedWithZod) {
      setIsSurveySaving(false);
      return false;
    }

    try {
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode, t);
      if (!isSurveyValidResult) {
        setIsSurveySaving(false);
        return false;
      }

      localSurvey.questions = localSurvey.questions.map((question) => {
        const { isDraft, ...rest } = question;
        return rest;
      });

      localSurvey.endings = localSurvey.endings.map((ending) => {
        if (ending.type === "redirectToUrl") {
          return ZSurveyRedirectUrlCard.parse(ending);
        } else {
          return ZSurveyEndScreenCard.parse(ending);
        }
      });

      if (localSurvey.type !== "link" && !localSurvey.triggers?.length) {
        toast.error(t("environments.surveys.edit.please_set_a_survey_trigger"));
        setIsSurveySaving(false);
        return false;
      }

      const segment = await handleSegmentUpdate();
      clearSurveyLocalStorage();
      const updatedSurveyResponse = await updateSurveyAction({ ...localSurvey, segment });

      setIsSurveySaving(false);
      if (updatedSurveyResponse?.data) {
        setLocalSurvey(updatedSurveyResponse.data);
        toast.success(t("environments.surveys.edit.changes_saved"));
      } else {
        const errorMessage = getFormattedErrorMessage(updatedSurveyResponse);
        toast.error(errorMessage);
        return false;
      }

      return true;
    } catch (e) {
      console.error(e);
      setIsSurveySaving(false);
      toast.error(t("environments.surveys.edit.error_saving_changes"));
      return false;
    }
  };

  const handleSaveAndGoBack = async () => {
    const isSurveySaved = await handleSurveySave();
    if (isSurveySaved) {
      router.back();
    }
  };

  const handleSurveyPublish = async () => {
    setIsSurveyPublishing(true);

    const isSurveyValidatedWithZod = validateSurveyWithZod();

    if (!isSurveyValidatedWithZod) {
      setIsSurveyPublishing(false);
      return;
    }

    try {
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode, t);
      if (!isSurveyValidResult) {
        setIsSurveyPublishing(false);
        return;
      }
      const status = localSurvey.runOnDate ? "scheduled" : "inProgress";
      const segment = await handleSegmentUpdate();
      clearSurveyLocalStorage();

      await updateSurveyAction({
        ...localSurvey,
        status,
        segment,
      });
      setIsSurveyPublishing(false);
      router.push(`/environments/${environmentId}/surveys/${localSurvey.id}/summary?success=true`);
    } catch (error) {
      console.error(error);
      toast.error(t("environments.surveys.edit.error_publishing_survey"));
      setIsSurveyPublishing(false);
    }
  };

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-5 py-2.5 sm:flex sm:items-center sm:justify-between">
        <div className="flex h-full items-center space-x-2 whitespace-nowrap">
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
          <p className="hidden pl-4 font-semibold md:block">{project.name} / </p>
          <Input
            defaultValue={localSurvey.name}
            onChange={(e) => {
              const updatedSurvey = { ...localSurvey, name: e.target.value };
              setLocalSurvey(updatedSurvey);
            }}
            className="h-8 w-72 border-white py-0 hover:border-slate-200"
          />
        </div>
        {responseCount > 0 && (
          <div className="flex items-center rounded-lg border border-amber-200 bg-amber-100 p-1.5 text-amber-800 shadow-xs lg:mx-auto">
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangleIcon className="h-5 w-5 text-amber-400" />
                </TooltipTrigger>
                <TooltipContent side={"top"} className="lg:hidden">
                  <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">{cautionText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="hidden pl-1.5 text-xs text-ellipsis whitespace-nowrap md:text-sm lg:block">
              {cautionText}
            </p>
          </div>
        )}
        <div className="mt-3 flex sm:mt-0 sm:ml-4">
          {!isCxMode && (
            <Button
              disabled={disableSave}
              variant="secondary"
              size="sm"
              className="mr-3"
              loading={isSurveySaving}
              onClick={() => handleSurveySave()}
              type="submit">
              {t("common.save")}
            </Button>
          )}

          {localSurvey.status !== "draft" && (
            <Button
              disabled={disableSave}
              className="mr-3"
              size="sm"
              loading={isSurveySaving}
              onClick={() => handleSaveAndGoBack()}>
              {t("environments.surveys.edit.save_and_close")}
            </Button>
          )}
          {localSurvey.status === "draft" && audiencePrompt && !isLinkSurvey && (
            <Button
              size="sm"
              onClick={() => {
                setAudiencePrompt(false);
                setActiveId("settings");
              }}>
              {t("environments.surveys.edit.continue_to_settings")}
              <SettingsIcon />
            </Button>
          )}
          {/* Always display Publish button for link surveys for better CR */}
          {localSurvey.status === "draft" && (!audiencePrompt || isLinkSurvey) && (
            <Button
              size="sm"
              disabled={isSurveySaving || containsEmptyTriggers}
              loading={isSurveyPublishing}
              onClick={handleSurveyPublish}>
              {isCxMode
                ? t("environments.surveys.edit.save_and_close")
                : t("environments.surveys.edit.publish")}
            </Button>
          )}
        </div>
        <AlertDialog
          headerText={t("environments.surveys.edit.confirm_survey_changes")}
          open={isConfirmDialogOpen}
          setOpen={setConfirmDialogOpen}
          mainText={t("environments.surveys.edit.unsaved_changes_warning")}
          confirmBtnLabel={t("common.save")}
          declineBtnLabel={t("common.discard")}
          declineBtnVariant="destructive"
          onDecline={() => {
            setConfirmDialogOpen(false);
            router.back();
          }}
          onConfirm={() => handleSaveAndGoBack()}
        />
      </div>
    </>
  );
};
