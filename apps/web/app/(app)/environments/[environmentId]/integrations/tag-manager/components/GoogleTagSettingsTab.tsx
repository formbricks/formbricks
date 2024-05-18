"use client";

import {
  deleteGoogleTagAction,
  updateGoogleTagAction,
} from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/actions";
import SurveyCheckboxGroup from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/SurveyCheckboxGroup";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import { TGoogleTag, TGoogleTagInput } from "@formbricks/types/google-tags";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface ActionSettingsTabProps {
  environmentId: string;
  tag: TGoogleTag;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
}

export default function GoogleTagSettingsTab({
  environmentId,
  tag,
  surveys,
  setOpen,
}: ActionSettingsTabProps) {
  const router = useRouter();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: tag.name,
      gtmId: tag.gtmId,
      surveyIds: tag.surveyIds,
    },
  });

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isUpdatingGoogleTag, setIsUpdatingGoogleTag] = useState(false);
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>(tag.surveyIds);
  const [gtmId, setGtmId] = useState(tag.gtmId);
  const [selectedAllSurveys, setSelectedAllSurveys] = useState(tag.surveyIds.length === 0);

  const handleSelectAllSurveys = () => {
    setSelectedAllSurveys(!selectedAllSurveys);
    setSelectedSurveys([]);
  };

  const handleSelectedSurveyChange = (surveyId) => {
    setSelectedSurveys((prevSelectedSurveys) => {
      if (prevSelectedSurveys.includes(surveyId)) {
        return prevSelectedSurveys.filter((id) => id !== surveyId);
      } else {
        return [...prevSelectedSurveys, surveyId];
      }
    });
  };

  const onSubmit = async (data) => {
    if (!selectedAllSurveys && selectedSurveys.length === 0) {
      toast.error("Please select at least one survey");
      return;
    }

    const updatedData: TGoogleTagInput = {
      name: data.name,
      gtmId: data.gtmId,
      surveyIds: selectedSurveys,
    };
    setIsUpdatingGoogleTag(true);
    await updateGoogleTagAction(environmentId, tag.id, updatedData);
    toast.success("Google tag updated successfully.");
    router.refresh();
    setIsUpdatingGoogleTag(false);
    setOpen(false);
  };

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="col-span-1">
          <Label htmlFor="Name">Name</Label>
          <div className="mt-1 flex">
            <Input
              type="text"
              id="name"
              {...register("name")}
              defaultValue={tag.name ?? ""}
              placeholder="Optional: Label your Google tag for easy identification"
            />
          </div>
        </div>

        <div className="col-span-1">
          <Label htmlFor="gtmId">Google Tag Manager ID (Container ID)</Label>
          <div className="mt-1 flex">
            <Input
              {...register("gtmId")}
              type="text"
              value={gtmId}
              onChange={(e) => {
                setGtmId(e.target.value);
              }}
              placeholder="Paste the Google tag manager here!"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="Surveys">Surveys</Label>
          <SurveyCheckboxGroup
            surveys={surveys}
            selectedSurveys={selectedSurveys}
            selectedAllSurveys={selectedAllSurveys}
            onSelectAllSurveys={handleSelectAllSurveys}
            onSelectedSurveyChange={handleSelectedSurveyChange}
            allowChanges={true}
          />
        </div>

        <div className="flex justify-between border-t border-slate-200 py-6">
          <div>
            <Button
              type="button"
              variant="warn"
              onClick={() => setOpenDeleteDialog(true)}
              StartIcon={TrashIcon}
              className="mr-3">
              Delete
            </Button>

            <Button
              variant="secondary"
              href="https://formbricks.com/docs/api/management/webhooks"
              target="_blank">
              Read Docs
            </Button>
          </div>

          <div className="flex space-x-2">
            <Button type="submit" variant="darkCTA" loading={isUpdatingGoogleTag}>
              Save changes
            </Button>
          </div>
        </div>
      </form>
      <DeleteDialog
        open={openDeleteDialog}
        setOpen={setOpenDeleteDialog}
        deleteWhat={"GoogleTag"}
        text="Are you sure you want to delete this Google tag? This will stop sending you any further notifications."
        onDelete={async () => {
          setOpen(false);
          try {
            await deleteGoogleTagAction(tag.id);
            router.refresh();
            toast.success("Google tag deleted successfully");
          } catch (error) {
            toast.error("Something went wrong. Please try again.");
          }
        }}
      />
    </div>
  );
}
