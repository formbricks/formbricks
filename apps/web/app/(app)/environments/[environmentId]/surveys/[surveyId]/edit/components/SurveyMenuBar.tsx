"use client";

import SurveyStatusDropdown from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { ArrowLeftIcon, Cog8ToothIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { isEqual } from "lodash";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { checkForEmptyFallBackValue } from "@formbricks/lib/utils/recall";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyQuestionType } from "@formbricks/types/surveys";
import AlertDialog from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

import { deleteSurveyAction, updateSurveyAction } from "../actions";
import { isLabelValidForAllLanguages, isValidUrl, validateQuestion } from "./Validation";

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
  languages: string[];
  selectedLanguage: string;
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
  languages,
  selectedLanguage,
}: SurveyMenuBarProps) {
  const router = useRouter();
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSurveyPublishing, setIsSurveyPublishing] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // write a function which updates the local survey status
  const updateLocalSurveyStatus = (status: TSurvey["status"]) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.status = status;
    setLocalSurvey(updatedSurvey);
  };

  const deleteSurvey = async (surveyId) => {
    try {
      await deleteSurveyAction(surveyId);
      router.refresh();
      setDeleteDialogOpen(false);
      router.back();
    } catch (error) {
      console.error("An error occurred deleting the survey");
      toast.error("An error occurred deleting the survey");
    }
  };

  const handleBack = () => {
    const createdAt = new Date(localSurvey.createdAt).getTime();
    const updatedAt = new Date(localSurvey.updatedAt).getTime();

    if (createdAt === updatedAt && localSurvey.status === "draft") {
      setDeleteDialogOpen(true);
    } else if (!isEqual(localSurvey, survey)) {
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
    if (survey.thankYouCard.enabled) {
      if (
        !isLabelValidForAllLanguages(survey.thankYouCard.headline ?? "", languages) ||
        (survey.thankYouCard.subheader &&
          survey.thankYouCard.subheader["en"] !== "" &&
          !isLabelValidForAllLanguages(survey.thankYouCard.subheader, languages))
      ) {
        faultyQuestions.push("end");
      }
    }
    if (survey.welcomeCard.enabled) {
      if (
        !isLabelValidForAllLanguages(survey.welcomeCard.headline, languages) ||
        (survey.welcomeCard.html &&
          survey.welcomeCard.html["en"] !== "" &&
          !isLabelValidForAllLanguages(survey.welcomeCard.html, languages))
      ) {
        faultyQuestions.push("start");
      }
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

    for (let index = 0; index < survey.questions.length; index++) {
      const question = survey.questions[index];
      const isValid = validateQuestion(question, languages);

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
          question.choices.some((element) => element.label[selectedLanguage]?.trim() === "") ||
          question.choices.some((element, index) =>
            question.choices
              .slice(index + 1)
              .some(
                (nextElement) =>
                  nextElement.label[selectedLanguage]?.trim() === element.label[selectedLanguage].trim()
              )
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

    /*
     Check whether the count for autocomplete responses is not less 
     than the current count of accepted response and also it is not set to 0
    */
    if ((survey.autoComplete && responseCount >= survey.autoComplete) || survey?.autoComplete === 0) {
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
      attributeFilters: localSurvey.attributeFilters.filter((attributeFilter) => {
        if (attributeFilter.attributeClassId && attributeFilter.value) {
          return true;
        }
      }),
    };

    if (!validateSurvey(localSurvey)) {
      setIsSurveySaving(false);
      return;
    }

    try {
      await updateSurveyAction({ ...strippedSurvey });
      setIsSurveySaving(false);
      toast.success("Changes saved.");
      if (shouldNavigateBack) {
        router.back();
      } else {
        if (localSurvey.status !== "draft") {
          router.push(`/environments/${environment.id}/surveys/${localSurvey.id}/summary`);
        } else {
          router.push(`/environments/${environment.id}/surveys`);
        }
      }
    } catch (e) {
      console.error(e);
      setIsSurveySaving(false);
      toast.error(`Error saving changes`);
      return;
    }
  };

  function containsEmptyTriggers() {
    return (
      localSurvey.type === "web" &&
      localSurvey.triggers &&
      (localSurvey.triggers[0] === "" || localSurvey.triggers.length === 0)
    );
  }

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
                  <ExclamationTriangleIcon className=" h-5 w-5 text-amber-400" />
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
            disabled={isSurveyPublishing || (localSurvey.status !== "draft" && containsEmptyTriggers())}
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
              EndIcon={Cog8ToothIcon}>
              Continue to Settings
            </Button>
          )}
          {localSurvey.status === "draft" && !audiencePrompt && (
            <Button
              disabled={isSurveySaving || containsEmptyTriggers()}
              variant="darkCTA"
              loading={isSurveyPublishing}
              onClick={async () => {
                setIsSurveyPublishing(true);
                if (!validateSurvey(localSurvey)) {
                  setIsSurveyPublishing(false);
                  return;
                }
                await updateSurveyAction({ ...localSurvey, status: "inProgress" });
                router.push(`/environments/${environment.id}/surveys/${localSurvey.id}/summary?success=true`);
              }}>
              Publish
            </Button>
          )}
        </div>
        <DeleteDialog
          deleteWhat="Draft"
          open={isDeleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          onDelete={async () => {
            setIsDeleting(true);
            await deleteSurvey(localSurvey.id);
            setIsDeleting(false);
          }}
          text="Do you want to delete this draft?"
          isDeleting={isDeleting}
          isSaving={isSaving}
          useSaveInsteadOfCancel={true}
          onSave={async () => {
            setIsSaving(true);
            await saveSurveyAction(true);
            setIsSaving(false);
          }}
        />
        <AlertDialog
          confirmWhat="Survey changes"
          open={isConfirmDialogOpen}
          setOpen={setConfirmDialogOpen}
          onDiscard={() => {
            setConfirmDialogOpen(false);
            router.back();
          }}
          text="You have unsaved changes in your survey. Would you like to save them before leaving?"
          confirmButtonLabel="Save"
          onSave={() => saveSurveyAction(true)}
        />
      </div>
    </>
  );
}
