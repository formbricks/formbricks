"use client";

import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { isEqual } from "lodash";
import { AlertTriangleIcon, ArrowLeftIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createSegmentAction } from "@formbricks/ee/advanced-targeting/lib/actions";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSegment } from "@formbricks/types/segment";
import {
  TSurvey,
  TSurveyEditorTabs,
  TSurveyQuestion,
  ZSurvey,
  ZSurveyEndScreenCard,
  ZSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { AlertDialog } from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { updateSurveyAction } from "../actions";
import { isSurveyValid } from "../lib/validation";

interface SurveyMenuBarProps {
  localSurvey: TSurvey;
  survey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  environment: TEnvironment;
  activeId: TSurveyEditorTabs;
  setActiveId: React.Dispatch<React.SetStateAction<TSurveyEditorTabs>>;
  setInvalidQuestions: React.Dispatch<React.SetStateAction<string[]>>;
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
}: SurveyMenuBarProps) => {
  const router = useRouter();
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isLinkSurvey, setIsLinkSurvey] = useState(true);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSurveyPublishing, setIsSurveyPublishing] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const cautionText = "This survey received responses.";

  useEffect(() => {
    if (audiencePrompt && activeId === "settings") {
      setAudiencePrompt(false);
    }
  }, [activeId, audiencePrompt]);

  useEffect(() => {
    setIsLinkSurvey(localSurvey.type === "link");
  }, [localSurvey.type]);

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
    if (localSurvey.type === "link") return false;

    const noTriggers = !localSurvey.triggers || localSurvey.triggers.length === 0 || !localSurvey.triggers[0];

    if (noTriggers) return true;

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
            (invalidLanguage: string) => getLanguageLabel(invalidLanguage) ?? invalidLanguage
          );

          toast.error(`${currentError.message} ${invalidLanguageLabels.join(", ")}`);
        } else {
          toast.error(currentError.message);
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
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode);
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

      const segment = await handleSegmentUpdate();
      const updatedSurveyResponse = await updateSurveyAction({ ...localSurvey, segment });

      setIsSurveySaving(false);
      if (updatedSurveyResponse?.data) {
        setLocalSurvey(updatedSurveyResponse.data);
        toast.success("Changes saved.");
      } else {
        const errorMessage = getFormattedErrorMessage(updatedSurveyResponse);
        toast.error(errorMessage);
      }

      return true;
    } catch (e) {
      console.error(e);
      setIsSurveySaving(false);
      toast.error(`Error saving changes`);
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
      const isSurveyValidResult = isSurveyValid(localSurvey, selectedLanguageCode);
      if (!isSurveyValidResult) {
        setIsSurveyPublishing(false);
        return;
      }
      const status = localSurvey.runOnDate ? "scheduled" : "inProgress";
      const segment = await handleSegmentUpdate();

      await updateSurveyAction({
        ...localSurvey,
        status,
        segment,
      });
      setIsSurveyPublishing(false);
      router.push(`/environments/${environment.id}/surveys/${localSurvey.id}/summary?success=true`);
    } catch (error) {
      toast.error("An error occured while publishing the survey.");
      setIsSurveyPublishing(false);
    }
  };

  return (
    <>
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
            className="w-72 border-white hover:border-slate-200"
          />
        </div>
        {responseCount > 0 && (
          <div className="ju flex items-center rounded-lg border border-amber-200 bg-amber-100 p-2 text-amber-700 shadow-sm lg:mx-auto">
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
            <p className="hidden pl-1 text-xs md:text-sm lg:block">{cautionText}</p>
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
            variant="secondary"
            className="mr-3"
            loading={isSurveySaving}
            onClick={() => handleSurveySave()}
            type="submit">
            Save
          </Button>
          {localSurvey.status !== "draft" && (
            <Button
              disabled={disableSave}
              className="mr-3"
              loading={isSurveySaving}
              onClick={() => handleSaveAndGoBack()}>
              Save & Close
            </Button>
          )}
          {localSurvey.status === "draft" && audiencePrompt && !isLinkSurvey && (
            <Button
              onClick={() => {
                setAudiencePrompt(false);
                setActiveId("settings");
              }}
              EndIcon={SettingsIcon}>
              Continue to Settings
            </Button>
          )}
          {/* Always display Publish button for link surveys for better CR */}
          {localSurvey.status === "draft" && (!audiencePrompt || isLinkSurvey) && (
            <Button
              disabled={isSurveySaving || containsEmptyTriggers}
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
          onConfirm={() => handleSaveAndGoBack()}
        />
      </div>
    </>
  );
};
