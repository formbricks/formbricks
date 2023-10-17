"use client";

import AlertDialog from "@formbricks/ui/AlertDialog";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { QuestionType } from "@formbricks/types/questions";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TProduct } from "@formbricks/types/v1/product";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { ArrowLeftIcon, Cog8ToothIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { isEqual } from "lodash";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { validateQuestion } from "./Validation";
import { deleteSurveyAction, updateSurveyAction } from "../actions";
import SurveyStatusDropdown from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";

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
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isMutatingSurvey, setIsMutatingSurvey] = useState(false);
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
      console.log("An error occurred deleting the survey");
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

  const validateSurvey = (survey) => {
    const existingQuestionIds = new Set();

    if (survey.questions.length === 0) {
      toast.error("Please add at least one question");
      return;
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
        question.type === QuestionType.MultipleChoiceSingle ||
        question.type === QuestionType.MultipleChoiceMulti
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
          toast.error("Incomplete logic jumps detected: Please fill or delete them.");
          return false;
        }

        if (question.required && logic.condition === "skipped") {
          toast.error("You have a missing logic condition. Please update or delete it.");
          return false;
        }

        const thisLogic = `${logic.condition}-${logic.value}`;
        if (existingLogicConditions.has(thisLogic)) {
          setInvalidQuestions([question.id]);
          toast.error("You have 2 competing logic conditons. Please update or delete one.");
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
    if (
      (survey.autoComplete && survey._count?.responses && survey._count.responses >= survey.autoComplete) ||
      survey?.autoComplete === 0
    ) {
      return false;
    }

    return true;
  };

  const saveSurveyAction = async (shouldNavigateBack = false) => {
    if (localSurvey.questions.length === 0) {
      toast.error("Please add at least one question.");
      return;
    }
    setIsMutatingSurvey(true);
    // Create a copy of localSurvey with isDraft removed from every question
    const strippedSurvey: TSurvey = {
      ...localSurvey,
      questions: localSurvey.questions.map((question) => {
        const { isDraft, ...rest } = question;
        return rest;
      }),
    };

    if (!validateSurvey(localSurvey)) {
      setIsMutatingSurvey(false);
      return;
    }

    try {
      await updateSurveyAction({ ...strippedSurvey });
      router.refresh();
      setIsMutatingSurvey(false);
      toast.success("Changes saved.");
      if (shouldNavigateBack) {
        router.back();
      } else {
        if (localSurvey.status !== "draft") {
          router.push(`/environments/${environment.id}/surveys/${localSurvey.id}/summary`);
        } else {
          router.push(`/environments/${environment.id}/surveys`);
        }
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      setIsMutatingSurvey(false);
      toast.error(`Error saving changes`);
      return;
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
          <div className="mx-auto flex items-center rounded-full border border-amber-200 bg-amber-100 p-2 text-amber-700 shadow-sm">
            <ExclamationTriangleIcon className=" h-5 w-5 text-amber-400" />
            <p className=" pl-1 text-xs lg:text-sm">
              This survey received responses, make changes with caution.
            </p>
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
            variant={localSurvey.status === "draft" ? "secondary" : "darkCTA"}
            className="mr-3"
            loading={isMutatingSurvey}
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
              disabled={
                localSurvey.type === "web" &&
                localSurvey.triggers &&
                (localSurvey.triggers[0] === "" || localSurvey.triggers.length === 0)
              }
              variant="darkCTA"
              loading={isMutatingSurvey}
              onClick={async () => {
                setIsMutatingSurvey(true);
                if (!validateSurvey(localSurvey)) {
                  setIsMutatingSurvey(false);
                  return;
                }
                await updateSurveyAction({ ...localSurvey, status: "inProgress" });
                router.refresh();
                setIsMutatingSurvey(false);
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
          onDelete={() => deleteSurvey(localSurvey.id)}
          text="Do you want to delete this draft?"
          useSaveInsteadOfCancel={true}
          onSave={() => saveSurveyAction(true)}
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
          useSaveInsteadOfCancel={true}
          onSave={() => saveSurveyAction(true)}
        />
      </div>
    </>
  );
}
