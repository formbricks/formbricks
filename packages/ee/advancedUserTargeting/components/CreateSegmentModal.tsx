"use client";

import { UserGroupIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TBaseFilter, TUserSegment } from "@formbricks/types/userSegment";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Modal } from "@formbricks/ui/Modal";

import { createUserSegmentAction } from "../lib/actions";
import AddFilterModal from "./AddFilterModal";
import SegmentFilters from "./SegmentFilters";

type TCreateSegmentModalProps = {
  environmentId: string;
  userSegments: TUserSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
};
const CreateSegmentModal = ({
  environmentId,
  actionClasses,
  attributeClasses,
  userSegments,
}: TCreateSegmentModalProps) => {
  const router = useRouter();
  const initialSegmentState = {
    title: "",
    description: "",
    isPrivate: false,
    filters: [],
    environmentId,
    id: "",
    surveys: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [open, setOpen] = useState(false);
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [userSegment, setUserSegment] = useState<TUserSegment>(initialSegmentState);
  const [isCreatingSegment, setIsCreatingSegment] = useState(false);

  const [titleError, setTitleError] = useState("");

  const handleResetState = () => {
    setUserSegment(initialSegmentState);
    setTitleError("");
    setOpen(false);
  };

  const handleAddFilterInGroup = (filter: TBaseFilter) => {
    const updatedUserSegment = structuredClone(userSegment);
    if (updatedUserSegment?.filters?.length === 0) {
      updatedUserSegment.filters.push({
        ...filter,
        connector: null,
      });
    } else {
      updatedUserSegment?.filters.push(filter);
    }

    setUserSegment(updatedUserSegment);
  };

  const handleCreateSegment = async () => {
    if (!userSegment.title) {
      setTitleError("Title is required");
      return;
    }

    try {
      setIsCreatingSegment(true);
      await createUserSegmentAction({
        title: userSegment.title,
        description: userSegment.description ?? "",
        isPrivate: userSegment.isPrivate,
        filters: userSegment.filters,
        environmentId,
        surveyId: "",
      });

      setIsCreatingSegment(false);
      toast.success("Segment created successfully!");
    } catch (err: any) {
      toast.error(`${err.message}`);
      setIsCreatingSegment(false);
      return;
    }

    handleResetState();
    setIsCreatingSegment(false);
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="darkCTA" onClick={() => setOpen(true)}>
          Create Segment
        </Button>
      </div>

      <Modal
        open={open}
        setOpen={() => {
          handleResetState();
        }}
        noPadding
        closeOnOutsideClick={false}
        className="md:w-full"
        size="lg">
        <div className="rounded-lg bg-slate-50">
          <div className="rounded-t-lg bg-slate-100">
            <div className="flex w-full items-center gap-4 p-6">
              <div className="flex items-center space-x-2">
                <div className="mr-1.5 h-6 w-6 text-slate-500">
                  <UserGroupIcon />
                </div>
                <div>
                  <h3 className="text-base font-medium">Create Segment</h3>
                  <p className="text-sm text-slate-600">
                    Segments help you target the users with the same characteristics easily.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col overflow-auto rounded-lg bg-white p-6">
            <div className="flex w-full items-center gap-4">
              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">Title</label>
                <div className="relative flex flex-col gap-1">
                  <Input
                    placeholder="Ex. Power Users"
                    onChange={(e) => {
                      setUserSegment((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }));
                    }}
                    className={cn(titleError && "border border-red-500 focus:border-red-500")}
                  />

                  {titleError && (
                    <p className="absolute right-1 bg-white text-xs text-red-500" style={{ top: "-8px" }}>
                      {titleError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">Description</label>
                <Input
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
            <div className="filter-scrollbar flex w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-700 bg-white p-4">
              <SegmentFilters
                environmentId={environmentId}
                userSegment={userSegment}
                setUserSegment={setUserSegment}
                group={userSegment.filters}
                actionClasses={actionClasses}
                attributeClasses={attributeClasses}
                userSegments={userSegments}
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

            <div className="flex justify-end pt-4">
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="minimal"
                  onClick={() => {
                    handleResetState();
                  }}>
                  Cancel
                </Button>
                <Button
                  variant="darkCTA"
                  type="submit"
                  loading={isCreatingSegment}
                  onClick={() => {
                    handleCreateSegment();
                  }}>
                  Create Segment
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CreateSegmentModal;
