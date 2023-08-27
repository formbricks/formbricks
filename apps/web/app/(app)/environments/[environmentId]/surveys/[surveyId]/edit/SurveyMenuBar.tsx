"use client";

import AlertDialog from "@/components/shared/AlertDialog";
import DeleteDialog from "@/components/shared/DeleteDialog";
import SurveyStatusDropdown from "@/components/shared/SurveyStatusDropdown";
import { useProduct } from "@/lib/products/products";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";
import { deleteSurvey } from "@/lib/surveys/surveys";
import type { Survey } from "@formbricks/types/surveys";
import { Button, Input } from "@formbricks/ui";
import { ArrowLeftIcon, Cog8ToothIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { isEqual } from "lodash";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { validateQuestion } from "./Validation";
import { TEnvironment } from "@formbricks/types/v1/environment";

interface SurveyMenuBarProps {
  localSurvey: Survey;
  survey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
  environment: TEnvironment;
  activeId: "questions" | "settings";
  setActiveId: (id: "questions" | "settings") => void;
  setInvalidQuestions: (invalidQuestions: String[]) => void;
}

export default function SurveyMenuBar({
  localSurvey,
  survey,
  environmentId,
  environment,
  setLocalSurvey,
  activeId,
  setActiveId,
  setInvalidQuestions,
}: SurveyMenuBarProps) {
  const router = useRouter();
  const { triggerSurveyMutate, isMutatingSurvey } = useSurveyMutation(environmentId, localSurvey.id);
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const { product } = useProduct(environmentId);
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
  const updateLocalSurveyStatus = (status: Survey["status"]) => {
    const updatedSurvey = JSON.parse(JSON.stringify(localSurvey));
    updatedSurvey.status = status;
    setLocalSurvey(updatedSurvey);
  };

  const deleteSurveyAction = async (survey) => {
    try {
      await deleteSurvey(environmentId, survey.id);
      setDeleteDialogOpen(false);
      router.back();
    } catch (error) {
      console.log("An error occurred deleting the survey");
    }
  };

  const handleBack = () => {
    if (localSurvey.createdAt === localSurvey.updatedAt && localSurvey.status === "draft") {
      setDeleteDialogOpen(true);
    } else if (!isEqual(localSurvey, survey)) {
      setConfirmDialogOpen(true);
    } else {
      router.back();
    }
  };

  const validateSurvey = (survey) => {
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
      toast.error("Please fill required fields");
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

  const saveSurveyAction = (shouldNavigateBack = false) => {
    // variable named strippedSurvey that is a copy of localSurvey with isDraft removed from every question
    const strippedSurvey = {
      ...localSurvey,
      questions: localSurvey.questions.map((question) => {
        const { isDraft, ...rest } = question;
        return rest;
      }),
    };

    if (!validateSurvey(localSurvey)) {
      return;
    }

    triggerSurveyMutate({ ...strippedSurvey })
      .then(async (response) => {
        if (!response?.ok) {
          throw new Error(await response?.text());
        }
        const updatedSurvey = await response.json();
        setLocalSurvey(updatedSurvey);
        toast.success("Changes saved.");
        if (shouldNavigateBack) {
          router.back();
        } else {
          if (localSurvey.status !== "draft") {
            router.push(`/environments/${environmentId}/surveys/${localSurvey.id}/summary`);
          } else {
            router.push(`/environments/${environmentId}/surveys`);
          }
        }
      })
      .catch(() => {
        toast.error(`Error saving changes`);
      });
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
        {!!localSurvey?.responseRate && (
          <div className="mx-auto flex items-center rounded-full border border-amber-200 bg-amber-100 p-2 text-amber-700 shadow-sm">
            <ExclamationTriangleIcon className=" h-5 w-5 text-amber-400" />
            <p className="max-w-[90%] pl-1 text-xs lg:text-sm">
              This survey received responses. To keep the data consistent, make changes with caution.
            </p>
          </div>
        )}
        <div className="mt-3 flex sm:ml-4 sm:mt-0">
          <div className="mr-4 flex items-center">
            <SurveyStatusDropdown
              surveyId={localSurvey.id}
              environmentId={environmentId}
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
                if (!validateSurvey(localSurvey)) {
                  return;
                }
                await triggerSurveyMutate({ ...localSurvey, status: "inProgress" });
                router.push(`/environments/${environmentId}/surveys/${localSurvey.id}/summary?success=true`);
              }}>
              Publish
            </Button>
          )}
        </div>
        <DeleteDialog
          deleteWhat="Draft"
          open={isDeleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          onDelete={() => deleteSurveyAction(localSurvey)}
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
