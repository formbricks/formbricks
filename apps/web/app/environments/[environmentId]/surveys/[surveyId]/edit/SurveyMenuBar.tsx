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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { isEqual } from "lodash";

interface SurveyMenuBarProps {
  localSurvey: Survey;
  survey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
  activeId: "questions" | "settings";
  setActiveId: (id: "questions" | "settings") => void;
}

export default function SurveyMenuBar({
  localSurvey,
  survey,
  environmentId,
  setLocalSurvey,
  activeId,
  setActiveId,
}: SurveyMenuBarProps) {
  const router = useRouter();
  const { triggerSurveyMutate, isMutatingSurvey } = useSurveyMutation(environmentId, localSurvey.id);
  const [audiencePrompt, setAudiencePrompt] = useState(true);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const { product } = useProduct(environmentId);

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
    const updatedSurvey = { ...localSurvey, status };
    setLocalSurvey(updatedSurvey);
  };

  const deleteSurveyAction = async (survey) => {
    try {
      await deleteSurvey(environmentId, survey.id);
      setDeleteDialogOpen(false);
      router.back();
    } catch (error) {
      console.log("An error occured deleting the survey");
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

  const saveSurveyAction = (shouldNavigateBack = false) => {
    triggerSurveyMutate({ ...localSurvey })
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
        <p className="pl-4 font-semibold">{product.name} / </p>
        <Input
          defaultValue={localSurvey.name}
          onChange={(e) => {
            const updatedSurvey = { ...localSurvey, name: e.target.value };
            setLocalSurvey(updatedSurvey);
          }}
          className="w-72 border-white hover:border-slate-200 "
        />
      </div>
      {localSurvey?.responseRate && (
        <div className="mx-auto flex items-center rounded-full border border-amber-200 bg-amber-100 p-2 text-sm text-amber-700 shadow-sm">
          <ExclamationTriangleIcon className="mr-2 h-5 w-5 text-amber-400" />
          This survey received responses. To keep the data consistent, make changes with caution.
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
  );
}
