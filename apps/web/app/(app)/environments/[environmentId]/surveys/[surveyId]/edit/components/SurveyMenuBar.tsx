"use client";

import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { validateSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/lib/validation";
import { isEqual } from "lodash";
import { AlertTriangleIcon, ArrowLeftIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyEditorTabs } from "@formbricks/types/surveys";
import { AlertDialog } from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

import { updateSurveyAction } from "../actions";

interface SurveyMenuBarProps {
  localSurvey: TSurvey;
  survey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  environment: TEnvironment;
  activeId: TSurveyEditorTabs;
  setActiveId: React.Dispatch<React.SetStateAction<TSurveyEditorTabs>>;
  setInvalidQuestions: (invalidQuestions: string[]) => void;
  product: TProduct;
  responseCount: number;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (selectedLanguage: string) => void;
}

export const SurveyMenuBar = ({
  localSurvey,
  survey,
  environment,
  setLocalSurvey,
  activeId,
  setActiveId,
  setInvalidQuestions,
  product,
  responseCount,
  selectedLanguageCode,
  setSelectedLanguageCode,
}: SurveyMenuBarProps) => {
  const router = useRouter();
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSurveyPublishing, setIsSurveyPublishing] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const cautionText = "This survey received responses, make changes with caution.";

  const faultyQuestions: string[] = [];

  useEffect(() => {
    if (audiencePrompt && activeId === "settings") {
      setAudiencePrompt(false);
    }
  }, [activeId, audiencePrompt]);

  useEffect(() => {
    const warningText = "You have unsaved changes - are you sure you wish to leave this page?";
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
  }, [localSurvey, survey]);

  const containsEmptyTriggers = useMemo(() => {
    if (localSurvey.type !== "web") return false;

    const noTriggers = !localSurvey.triggers || localSurvey.triggers.length === 0 || !localSurvey.triggers[0];
    const noInlineTriggers =
      !localSurvey.inlineTriggers ||
      (!localSurvey.inlineTriggers?.codeConfig && !localSurvey.inlineTriggers?.noCodeConfig);

    if (noTriggers && noInlineTriggers) {
      return true;
    }

    return false;
  }, [localSurvey]);

  const disableSave = useMemo(() => {
    if (isSurveySaving) return true;

    if (localSurvey.status !== "draft" && containsEmptyTriggers) return true;
  }, [containsEmptyTriggers, isSurveySaving, localSurvey.status]);

  // write a function which updates the local survey status
  const updateLocalSurveyStatus = (status: TSurvey["status"]) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.status = status;
    setLocalSurvey(updatedSurvey);
  };

  const handleBack = () => {
    const { updatedAt, ...localSurveyRest } = localSurvey;
    const { updatedAt: _, ...surveyRest } = survey;
    localSurveyRest.triggers = localSurveyRest.triggers.filter((trigger) => Boolean(trigger));

    if (!isEqual(localSurveyRest, surveyRest)) {
      setConfirmDialogOpen(true);
    } else {
      router.back();
    }
  };

  const handleSurveySave = async (shouldNavigateBack = false) => {
    setIsSurveySaving(true);
    try {
      if (
        !validateSurvey(
          localSurvey,
          faultyQuestions,
          setInvalidQuestions,
          selectedLanguageCode,
          setSelectedLanguageCode
        )
      ) {
        setIsSurveySaving(false);
        return;
      }
      localSurvey.triggers = localSurvey.triggers.filter((trigger) => Boolean(trigger));
      localSurvey.questions = localSurvey.questions.map((question) => {
        const { isDraft, ...rest } = question;
        return rest;
      });

      await updateSurveyAction({ ...localSurvey });
      setIsSurveySaving(false);
      setLocalSurvey(localSurvey);
      toast.success("Changes saved.");
      if (shouldNavigateBack) {
        router.back();
      }
    } catch (e) {
      console.error(e);
      setIsSurveySaving(false);
      toast.error(`Error saving changes`);
      return;
    }
  };

  const handleSurveyPublish = async () => {
    setIsSurveyPublishing(true);
    try {
      if (
        !validateSurvey(
          localSurvey,
          faultyQuestions,
          setInvalidQuestions,
          selectedLanguageCode,
          setSelectedLanguageCode
        )
      ) {
        setIsSurveyPublishing(false);
        return;
      }
      const status = localSurvey.runOnDate ? "scheduled" : "inProgress";
      await updateSurveyAction({ ...localSurvey, status });
      setIsSurveyPublishing(false);
      router.push(`/environments/${environment.id}/surveys/${localSurvey.id}/summary?success=true`);
    } catch (error) {
      toast.error("An error occured while publishing the survey.");
      setIsSurveyPublishing(false);
    }
  };

  return (
    <>
      {environment?.type === "development" && (
        <nav className="top-0 z-10 w-full border-b border-slate-200 bg-white">
          <div className="h-6 w-full bg-[#A33700] p-0.5 text-center text-sm text-white">
            You&apos;re in development mode. Use it to test surveys, actions and attributes.
          </div>
        </nav>
      )}
      <div className="border-b border-slate-200 bg-white px-5 py-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2 whitespace-nowrap">
          <Button
            variant="secondary"
            StartIcon={ArrowLeftIcon}
            onClick={() => {
              handleBack();
            }}>
            Back
          </Button>
          <p className="hidden pl-4 font-semibold md:block">{product.name} / </p>
          <Input
            defaultValue={localSurvey.name}
            onChange={(e) => {
              const updatedSurvey = { ...localSurvey, name: e.target.value };
              setLocalSurvey(updatedSurvey);
            }}
            className="w-72 border-white hover:border-slate-200 "
          />
        </div>
        {responseCount > 0 && (
          <div className="ju flex items-center rounded-lg border border-amber-200 bg-amber-100 p-2 text-amber-700 shadow-sm lg:mx-auto">
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangleIcon className=" h-5 w-5 text-amber-400" />
                </TooltipTrigger>
                <TooltipContent side={"top"} className="lg:hidden">
                  <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400 ">
                    {cautionText}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className=" hidden pl-1 text-xs md:text-sm lg:block">{cautionText}</p>
          </div>
        )}
        <div className="mt-3 flex sm:ml-4 sm:mt-0">
          <div className="mr-4 flex items-center">
            <SurveyStatusDropdown
              survey={survey}
              environment={environment}
              updateLocalSurveyStatus={updateLocalSurveyStatus}
            />
          </div>
          <Button
            disabled={disableSave}
            variant={localSurvey.status === "draft" ? "secondary" : "darkCTA"}
            className="mr-3"
            loading={isSurveySaving}
            onClick={() => handleSurveySave()}>
            Save
          </Button>
          {localSurvey.status === "draft" && audiencePrompt && (
            <Button
              variant="darkCTA"
              onClick={() => {
                setAudiencePrompt(false);
                setActiveId("settings");
              }}
              EndIcon={SettingsIcon}>
              Continue to Settings
            </Button>
          )}
          {localSurvey.status === "draft" && !audiencePrompt && (
            <Button
              disabled={isSurveySaving || containsEmptyTriggers}
              variant="darkCTA"
              loading={isSurveyPublishing}
              onClick={handleSurveyPublish}>
              Publish
            </Button>
          )}
        </div>
        <AlertDialog
          headerText="Confirm Survey Changes"
          open={isConfirmDialogOpen}
          setOpen={setConfirmDialogOpen}
          mainText="You have unsaved changes in your survey. Would you like to save them before leaving?"
          confirmBtnLabel="Save"
          declineBtnLabel="Discard"
          declineBtnVariant="warn"
          onDecline={() => {
            setConfirmDialogOpen(false);
            router.back();
          }}
          onConfirm={() => handleSurveySave(true)}
        />
      </div>
    </>
  );
};
