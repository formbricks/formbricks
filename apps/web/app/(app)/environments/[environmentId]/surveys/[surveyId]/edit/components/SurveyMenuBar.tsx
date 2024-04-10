"use client";

import SurveyStatusDropdown from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import {
  isCardValid,
  validateQuestion,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/lib/validation";
import { isEqual } from "lodash";
import { AlertTriangleIcon, ArrowLeftIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { checkForEmptyFallBackValue } from "@formbricks/lib/utils/recall";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { ZSegmentFilters } from "@formbricks/types/segment";
import {
  TI18nString,
  TSurvey,
  TSurveyEditorTabs,
  TSurveyQuestionType,
  ZSurveyInlineTriggers,
  surveyHasBothTriggers,
} from "@formbricks/types/surveys";
import AlertDialog from "@formbricks/ui/AlertDialog";
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

export default function SurveyMenuBar({
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
}: SurveyMenuBarProps) {
  const router = useRouter();
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSurveyPublishing, setIsSurveyPublishing] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const cautionText = "This survey received responses, make changes with caution.";

  let faultyQuestions: string[] = [];

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

  const validateSurvey = (survey: TSurvey) => {
    const existingQuestionIds = new Set();
    faultyQuestions = [];
    if (survey.questions.length === 0) {
      toast.error("Please add at least one question");
      return;
    }

    if (survey.welcomeCard.enabled) {
      if (!isCardValid(survey.welcomeCard, "start", survey.languages)) {
        faultyQuestions.push("start");
      }
    }

    if (survey.thankYouCard.enabled) {
      if (!isCardValid(survey.thankYouCard, "end", survey.languages)) {
        faultyQuestions.push("end");
      }
    }

    let pin = survey?.pin;
    if (pin !== null && pin!.toString().length !== 4) {
      toast.error("PIN must be a four digit number.");
      return;
    }

    for (let index = 0; index < survey.questions.length; index++) {
      const question = survey.questions[index];
      const isFirstQuestion = index === 0;
      const isValid = validateQuestion(question, survey.languages, isFirstQuestion);

      if (!isValid) {
        faultyQuestions.push(question.id);
      }
    }

    // if there are any faulty questions, the user won't be allowed to save the survey
    if (faultyQuestions.length > 0) {
      setInvalidQuestions(faultyQuestions);
      setSelectedLanguageCode("default");
      toast.error("Please fill all required fields.");
      return false;
    }

    for (const question of survey.questions) {
      const existingLogicConditions = new Set();

      if (existingQuestionIds.has(question.id)) {
        toast.error("There are 2 identical question IDs. Please update one.");
        return false;
      }
      existingQuestionIds.add(question.id);

      if (
        question.type === TSurveyQuestionType.MultipleChoiceSingle ||
        question.type === TSurveyQuestionType.MultipleChoiceMulti
      ) {
        const haveSameChoices =
          question.choices.some((element) => element.label[selectedLanguageCode]?.trim() === "") ||
          question.choices.some((element, index) =>
            question.choices
              .slice(index + 1)
              .some(
                (nextElement) =>
                  nextElement.label[selectedLanguageCode]?.trim() ===
                  element.label[selectedLanguageCode].trim()
              )
          );

        if (haveSameChoices) {
          toast.error("You have empty or duplicate choices.");
          return false;
        }
      }

      if (question.type === TSurveyQuestionType.Matrix) {
        const hasDuplicates = (labels: TI18nString[]) => {
          const flattenedLabels = labels
            .map((label) => Object.keys(label).map((lang) => `${lang}:${label[lang].trim().toLowerCase()}`))
            .flat();

          return new Set(flattenedLabels).size !== flattenedLabels.length;
        };

        // Function to check for empty labels in each language
        const hasEmptyLabels = (labels: TI18nString[]) => {
          return labels.some((label) => Object.values(label).some((value) => value.trim() === ""));
        };

        if (hasEmptyLabels(question.rows) || hasEmptyLabels(question.columns)) {
          toast.error("Empty row or column labels in one or more languages");
          setInvalidQuestions([question.id]);
          return false;
        }

        if (hasDuplicates(question.rows)) {
          toast.error("You have duplicate row labels.");
          return false;
        }

        if (hasDuplicates(question.columns)) {
          toast.error("You have duplicate column labels.");
          return false;
        }
      }

      for (const logic of question.logic || []) {
        const validFields = ["condition", "destination", "value"].filter(
          (field) => logic[field] !== undefined
        ).length;

        if (validFields < 2) {
          setInvalidQuestions([question.id]);
          toast.error("Incomplete logic jumps detected: Fill or remove them in the Questions tab.");
          return false;
        }

        if (question.required && logic.condition === "skipped") {
          toast.error("A logic condition is missing: Please update or delete it in the Questions tab.");
          return false;
        }

        const thisLogic = `${logic.condition}-${logic.value}`;
        if (existingLogicConditions.has(thisLogic)) {
          setInvalidQuestions([question.id]);
          toast.error(
            "There are two competing logic conditons: Please update or delete one in the Questions tab."
          );
          return false;
        }
        existingLogicConditions.add(thisLogic);
      }
    }

    if (
      survey.redirectUrl &&
      !survey.redirectUrl.includes("https://") &&
      !survey.redirectUrl.includes("http://")
    ) {
      toast.error("Please enter a valid URL for redirecting respondents.");
      return false;
    }

    return true;
  };

  const saveSurveyAction = async (shouldNavigateBack = false) => {
    if (localSurvey.questions.length === 0) {
      toast.error("Please add at least one question.");
      return;
    }

    const questionWithEmptyFallback = checkForEmptyFallBackValue(localSurvey, selectedLanguageCode);
    if (questionWithEmptyFallback) {
      toast.error("Fallback missing");
      return;
    }

    setIsSurveySaving(true);
    // Create a copy of localSurvey with isDraft removed from every question
    const strippedSurvey: TSurvey = {
      ...localSurvey,
      questions: localSurvey.questions.map((question) => {
        const { isDraft, ...rest } = question;
        return rest;
      }),
    };

    if (!validateSurvey(localSurvey)) {
      setIsSurveySaving(false);
      return;
    }

    // validate the user segment filters
    const localSurveySegment = {
      id: strippedSurvey.segment?.id,
      filters: strippedSurvey.segment?.filters,
      title: strippedSurvey.segment?.title,
      description: strippedSurvey.segment?.description,
    };

    const surveySegment = {
      id: survey.segment?.id,
      filters: survey.segment?.filters,
      title: survey.segment?.title,
      description: survey.segment?.description,
    };

    // if the non-private segment in the survey and the strippedSurvey are different, don't save
    if (!strippedSurvey.segment?.isPrivate && !isEqual(localSurveySegment, surveySegment)) {
      toast.error("Please save the audience filters before saving the survey");
      setIsSurveySaving(false);
      return;
    }

    if (!!strippedSurvey.segment?.filters?.length) {
      const parsedFilters = ZSegmentFilters.safeParse(strippedSurvey.segment.filters);
      if (!parsedFilters.success) {
        const errMsg =
          parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message ||
          "Invalid targeting: Please check your audience filters";
        setIsSurveySaving(false);
        toast.error(errMsg);
        return;
      }
    }

    // if inlineTriggers are present validate with zod
    if (!!strippedSurvey.inlineTriggers) {
      const parsedInlineTriggers = ZSurveyInlineTriggers.safeParse(strippedSurvey.inlineTriggers);
      if (!parsedInlineTriggers.success) {
        toast.error("Invalid Custom Actions: Please check your custom actions");
        return;
      }
    }

    // validate that both triggers and inlineTriggers are not present
    if (surveyHasBothTriggers(strippedSurvey)) {
      setIsSurveySaving(false);
      toast.error("Survey cannot have both custom and saved actions, please remove one.");
      return;
    }

    strippedSurvey.triggers = strippedSurvey.triggers.filter((trigger) => Boolean(trigger));
    try {
      await updateSurveyAction({ ...strippedSurvey });

      setIsSurveySaving(false);
      setLocalSurvey(strippedSurvey);
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
    try {
      setIsSurveyPublishing(true);
      if (!validateSurvey(localSurvey)) {
        setIsSurveyPublishing(false);
        return;
      }
      const status = localSurvey.runOnDate ? "scheduled" : "inProgress";
      await updateSurveyAction({ ...localSurvey, status });
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
            onClick={() => saveSurveyAction()}>
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
          onConfirm={() => saveSurveyAction(true)}
        />
      </div>
    </>
  );
}
