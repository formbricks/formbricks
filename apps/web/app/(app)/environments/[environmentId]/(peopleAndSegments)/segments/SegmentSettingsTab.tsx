"use client";

import AddFilterModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/AddFilterModal";
import SegmentFilters from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/SegmentFilters";
import {
  deleteUserSegmentAction,
  updateUserSegmentAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { cn } from "@formbricks/lib/cn";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import { TAttributeClass } from "@formbricks/types/v1/attributeClasses";
import {
  TBaseFilterGroupItem,
  TUserSegment,
  ZUserSegmentFilterGroup,
} from "@formbricks/types/v1/userSegment";
import { Button, Input } from "@formbricks/ui";
import { produce } from "immer";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type TSegmentSettingsTabProps = {
  environmentId: string;
  setOpen: (open: boolean) => void;
  initialSegment: TUserSegment;
  userSegments: TUserSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
};

const SegmentSettingsTab = ({
  environmentId,
  initialSegment,
  setOpen,
  actionClasses,
  attributeClasses,
  userSegments,
}: TSegmentSettingsTabProps) => {
  const router = useRouter();

  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [userSegment, setUserSegment] = useState<TUserSegment>(initialSegment);

  const [isUpdatingSegment, setIsUpdatingSegment] = useState(false);
  const [isDeletingSegment, setIsDeletingSegment] = useState(false);

  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  const [isSaveDisabled, setIsSaveDisabled] = useState(false);

  const handleResetState = () => {
    setUserSegment(initialSegment);
    setOpen(false);

    setTitleError("");
    setDescriptionError("");

    router.refresh();
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

  const handleUpdateSegment = async () => {
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

  const handleDeleteSegment = async () => {
    try {
      setIsDeletingSegment(true);
      await deleteUserSegmentAction(userSegment.id);

      setIsDeletingSegment(false);
      toast.success("Segment deleted successfully!");
      handleResetState();
    } catch (err) {
      toast.error(`${err.message}`);
    }

    setIsDeletingSegment(false);
  };

  useEffect(() => {
    // parse the filters to check if they are valid
    const parsedFilters = ZUserSegmentFilterGroup.safeParse(userSegment.filters);
    if (!parsedFilters.success) {
      setIsSaveDisabled(true);
    } else {
      setIsSaveDisabled(false);
    }
  }, [userSegment]);

  return (
    <>
      <div className="mb-4">
        <div className="rounded-lg bg-slate-50">
          <div className="flex flex-col overflow-auto rounded-lg bg-white">
            <div className="flex w-full items-center gap-4">
              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">Title</label>
                <div className="relative flex flex-col gap-1">
                  <Input
                    value={userSegment.title}
                    placeholder="Ex. Power Users"
                    onChange={(e) => {
                      setUserSegment((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }));

                      if (e.target.value) {
                        setTitleError("");
                      }
                    }}
                    className={cn("w-auto", titleError && "border border-red-500 focus:border-red-500")}
                  />

                  {titleError && (
                    <p className="absolute -bottom-1.5 right-2 bg-white text-xs text-red-500">{titleError}</p>
                  )}
                </div>
              </div>

              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">Description</label>
                <div className="relative flex flex-col gap-1">
                  <Input
                    value={userSegment.description}
                    placeholder="Ex. Power Users"
                    onChange={(e) => {
                      setUserSegment((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }));

                      if (e.target.value) {
                        setDescriptionError("");
                      }
                    }}
                    className={cn("w-auto", descriptionError && "border border-red-500 focus:border-red-500")}
                  />

                  {descriptionError && (
                    <p className="absolute -bottom-1.5 right-2 bg-white text-xs text-red-500">
                      {descriptionError}
                    </p>
                  )}
                </div>
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
                onAddFilter={(filter) => {
                  handleAddFilterInGroup(filter);
                }}
                open={addFilterModalOpen}
                setOpen={setAddFilterModalOpen}
                actionClasses={actionClasses}
                attributeClasses={attributeClasses}
                userSegments={userSegments}
              />
            </div>

            <div className="flex w-full items-center justify-between pt-4">
              <Button
                type="button"
                variant="warn"
                loading={isDeletingSegment}
                onClick={() => {
                  handleDeleteSegment();
                }}>
                Delete
              </Button>
              <Button
                variant="darkCTA"
                type="submit"
                loading={isUpdatingSegment}
                onClick={() => {
                  handleUpdateSegment();
                }}
                disabled={isSaveDisabled}>
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
