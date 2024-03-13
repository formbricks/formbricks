"use client";

import SurveyStatusDropdown from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
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
  TSurvey,
  TSurveyQuestionType,
  ZSurveyInlineTriggers,
  surveyHasBothTriggers,
} from "@formbricks/types/surveys";
import AlertDialog from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

import { updateSurveyAction } from "../actions";
import { isValidUrl, validateQuestion } from "./Validation";

interface SurveyMenuBarProps {
  localSurvey: TSurvey;
  survey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  environment: TEnvironment;
  activeId: "questions" | "settings";
  setActiveId: (id: "questions" | "settings") => void;
  setInvalidQuestions: (invalidQuestions: String[]) => void;
  product: TProduct;
  responseCount: number;
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
}: SurveyMenuBarProps) {
  const router = useRouter();
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSurveyPublishing, setIsSurveyPublishing] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const cautionText = "This survey received responses, make changes with caution.";

  let faultyQuestions: String[] = [];

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
    if (!isEqual(localSurvey, survey)) {
      setConfirmDialogOpen(true);
    } else {
      router.back();
    }
  };

  const validateSurvey = (survey: TSurvey) => {
    const existingQuestionIds = new Set();

    if (survey.questions.length === 0) {
      toast.error("Please add at least one question");
      return;
    }

    let pin = survey?.pin;
    if (pin !== null && pin!.toString().length !== 4) {
      toast.error("PIN must be a four digit number.");
      return;
    }

    const { thankYouCard } = localSurvey;
    if (thankYouCard.enabled) {
      const { buttonLabel, buttonLink } = thankYouCard;

      if (buttonLabel && !buttonLink) {
        toast.error("Button Link missing on Thank you card.");
        return;
      }

      if (!buttonLabel && buttonLink) {
        toast.error("Button Label missing on Thank you card.");
        return;
      }

      if (buttonLink && !isValidUrl(buttonLink)) {
        toast.error("Invalid URL on Thank You card.");
        return;
      }
    }

    faultyQuestions = [];
    for (let index = 0; index < survey.questions.length; index++) {
      const question = survey.questions[index];
      const isValid = validateQuestion(question);

      if (!isValid) {
        faultyQuestions.push(question.id);
      }
    }

    // if there are any faulty questions, the user won't be allowed to save the survey
    if (faultyQuestions.length > 0) {
      setInvalidQuestions(faultyQuestions);
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
          question.choices.some((element) => element.label.trim() === "") ||
          question.choices.some((element, index) =>
            question.choices
              .slice(index + 1)
              .some((nextElement) => nextElement.label.trim() === element.label.trim())
          );

        if (haveSameChoices) {
          toast.error("You have two identical choices.");
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
    const questionWithEmptyFallback = checkForEmptyFallBackValue(localSurvey);
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

    try {
      await updateSurveyAction({ ...strippedSurvey });
      setIsSurveySaving(false);
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
      await updateSurveyAction({ ...localSurvey, status: "inProgress" });
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
            // disabled={isSurveyPublishing || (localSurvey.status !== "draft" && containsEmptyTriggers())}
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
