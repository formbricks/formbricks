import { createGoogleTagAction } from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/actions";
import SurveyCheckboxGroup from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/SurveyCheckboxGroup";
import { Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { TGoogleTagInput } from "@formbricks/types/google-tags";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";

interface AddGoogleTagModalProps {
  environmentId: string;
  open: boolean;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
}

export const AddGoogleTagModal = ({ environmentId, surveys, open, setOpen }: AddGoogleTagModalProps) => {
  const router = useRouter();
  const {
    handleSubmit,
    reset,
    register,
    formState: { isSubmitting },
  } = useForm();

  const [gtmId, setGtmId] = useState("");
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>([]);
  const [selectedAllSurveys, setSelectedAllSurveys] = useState(false);
  const [creatingGoogleTag, setCreatingGoogleTag] = useState(false);

  const handleSelectAllSurveys = () => {
    setSelectedAllSurveys(!selectedAllSurveys);
    setSelectedSurveys([]);
  };

  const handleSelectedSurveyChange = (surveyId: string) => {
    setSelectedSurveys((prevSelectedSurveys: string[]) =>
      prevSelectedSurveys.includes(surveyId)
        ? prevSelectedSurveys.filter((id) => id !== surveyId)
        : [...prevSelectedSurveys, surveyId]
    );
  };

  const submitGoogleTag = async (data: TGoogleTagInput): Promise<void> => {
    if (!isSubmitting) {
      try {
        setCreatingGoogleTag(true);

        if (!selectedAllSurveys && selectedSurveys.length === 0) {
          throw new Error("Please select at least one survey");
        }

        const updatedData: TGoogleTagInput = {
          name: data.name,
          gtmId: data.gtmId,
          surveyIds: selectedSurveys,
        };

        await createGoogleTagAction(environmentId, updatedData);
        router.refresh();
        setOpenWithStates(false);
        toast.success("Google tag added successfully.");
      } catch (e) {
        toast.error(e.message);
      } finally {
        setCreatingGoogleTag(false);
      }
    }
  };

  const setOpenWithStates = (isOpen: boolean) => {
    setOpen(isOpen);
    reset();
    setGtmId("");
    setSelectedSurveys([]);
    setSelectedAllSurveys(false);
  };

  return (
    <Modal open={open} setOpen={setOpenWithStates} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <Tag />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Add New Tag</div>
                <div className="text-sm text-slate-500">
                  Integrate Formbricks with your Google Analytics Account for precise tracking.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitGoogleTag)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div className="col-span-1">
                <Label htmlFor="name">Name</Label>
                <div className="mt-1 flex">
                  <Input
                    type="text"
                    id="name"
                    {...register("name")}
                    placeholder="Optional: Label your tag for easy identification"
                  />
                </div>
              </div>

              <div className="col-span-1">
                <Label htmlFor="gtmId">Google Tag Manager ID (Container ID)</Label>
                <div className="mt-1 flex">
                  <Input
                    type="text"
                    id="gtmId"
                    {...register("gtmId")}
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
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="minimal"
                onClick={() => {
                  setOpenWithStates(false);
                }}>
                Cancel
              </Button>
              <Button variant="darkCTA" type="submit" loading={creatingGoogleTag}>
                Add Tag
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
