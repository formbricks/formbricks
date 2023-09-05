"use client";

import AddFilterModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/AddFilterModal";
import SegmentFilters from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/SegmentFilters";
import { updateUserSegmentAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { TBaseFilterGroupItem, TUserSegment } from "@formbricks/types/v1/userSegment";
import { Button, Input } from "@formbricks/ui";
import { produce } from "immer";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

type TSegmentSettingsTabProps = {
  environmentId: string;
  setOpen: (open: boolean) => void;
  initialSegment: TUserSegment;
};

const SegmentSettingsTab = ({ environmentId, initialSegment, setOpen }: TSegmentSettingsTabProps) => {
  const router = useRouter();

  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [userSegment, setUserSegment] = useState<TUserSegment>(initialSegment);

  const [isUpdatingSegment, setIsUpdatingSegment] = useState(false);

  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  const handleResetState = () => {
    setUserSegment(initialSegment);
    setOpen(false);
  };

  const handleAddFilterInGroup = (filter: TBaseFilterGroupItem) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      if (draft?.filters?.length === 0) {
        draft.filters.push({
          ...filter,
          connector: null,
        });
      } else {
        draft?.filters.push(filter);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const handleCreateSegment = async () => {
    if (!userSegment.title) {
      setTitleError("Title is required");
      return;
    }

    if (!userSegment.description) {
      setDescriptionError("Description is required");
      return;
    }

    try {
      setIsUpdatingSegment(true);
      await updateUserSegmentAction(userSegment.id, {
        title: userSegment.title,
        description: userSegment.description ?? "",
        isPrivate: userSegment.isPrivate,
        filters: userSegment.filters,
      });

      setIsUpdatingSegment(false);
      toast.success("Segment updated successfully!");
    } catch (err) {
      toast.error(`${err.message}`);
      setIsUpdatingSegment(false);
      return;
    }

    setIsUpdatingSegment(false);
    handleResetState();
    router.refresh();
  };

  return (
    <>
      <div className="mb-4">
        <div className="rounded-lg bg-slate-50">
          <div className="flex flex-col overflow-auto rounded-lg bg-white">
            <div className="flex w-full items-center gap-4">
              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">Title</label>
                {titleError && <div className="text-sm text-red-500">{titleError}</div>}
                <Input
                  value={userSegment.title}
                  placeholder="Ex. Power Users"
                  onChange={(e) => {
                    setUserSegment((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }));
                  }}
                />
              </div>

              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">Description</label>
                {descriptionError && <div className="text-sm text-red-500">{descriptionError}</div>}
                <Input
                  value={userSegment.description}
                  placeholder="Ex. Fully activated recurring users"
                  onChange={(e) => {
                    setUserSegment((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                />
              </div>
            </div>

            <label className="my-4 text-sm font-medium text-slate-900">Targeting</label>
            <div className="filter-scrollbar flex max-h-96 w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-700 bg-white p-4">
              <SegmentFilters
                environmentId={environmentId}
                userSegment={userSegment}
                setUserSegment={setUserSegment}
                group={userSegment.filters}
              />

              <div>
                <Button variant="secondary" size="sm" onClick={() => setAddFilterModalOpen(true)}>
                  Add Filter
                </Button>
              </div>

              <AddFilterModal
                environmentId={environmentId}
                onAddFilter={(filter) => {
                  handleAddFilterInGroup(filter);
                }}
                open={addFilterModalOpen}
                setOpen={setAddFilterModalOpen}
              />
            </div>

            <div className="flex w-full items-center justify-between pt-4">
              <Button
                type="button"
                variant="warn"
                onClick={() => {
                  handleResetState();
                }}>
                Delete
              </Button>
              <Button
                variant="darkCTA"
                type="submit"
                loading={isUpdatingSegment}
                onClick={() => {
                  handleCreateSegment();
                }}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SegmentSettingsTab;
