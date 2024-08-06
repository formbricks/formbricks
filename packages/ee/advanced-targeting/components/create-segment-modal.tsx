"use client";

import { FilterIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import type { TActionClass } from "@formbricks/types/action-classes";
import type { TAttributeClass } from "@formbricks/types/attribute-classes";
import type { TBaseFilter, TSegment } from "@formbricks/types/segment";
import { ZSegmentFilters } from "@formbricks/types/segment";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Modal } from "@formbricks/ui/Modal";
import { createSegmentAction } from "../lib/actions";
import { AddFilterModal } from "./add-filter-modal";
import { SegmentEditor } from "./segment-editor";

interface TCreateSegmentModalProps {
  environmentId: string;
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
}

export function CreateSegmentModal({
  environmentId,
  actionClasses,
  attributeClasses,
  segments,
}: TCreateSegmentModalProps) {
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
  const [segment, setSegment] = useState<TSegment>(initialSegmentState);
  const [isCreatingSegment, setIsCreatingSegment] = useState(false);

  const handleResetState = () => {
    setSegment(initialSegmentState);
    setOpen(false);
  };

  const handleAddFilterInGroup = (filter: TBaseFilter) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters.length === 0) {
      updatedSegment.filters.push({
        ...filter,
        connector: null,
      });
    } else {
      updatedSegment.filters.push(filter);
    }

    setSegment(updatedSegment);
  };

  const handleCreateSegment = async () => {
    if (!segment.title) {
      toast.error("Title is required.");
      return;
    }

    try {
      setIsCreatingSegment(true);
      await createSegmentAction({
        title: segment.title,
        description: segment.description ?? "",
        isPrivate: segment.isPrivate,
        filters: segment.filters,
        environmentId,
        surveyId: "",
      });

      setIsCreatingSegment(false);
      toast.success("Segment created successfully!");
    } catch (err: any) {
      // parse the segment filters to check if they are valid
      const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
      if (!parsedFilters.success) {
        toast.error("Invalid filters. Please check the filters and try again.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
      setIsCreatingSegment(false);
      return;
    }

    handleResetState();
    setIsCreatingSegment(false);
    router.refresh();
  };

  const isSaveDisabled = useMemo(() => {
    // check if title is empty

    if (!segment.title) {
      return true;
    }

    // parse the filters to check if they are valid
    const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
    if (!parsedFilters.success) {
      return true;
    }

    return false;
  }, [segment]);

  return (
    <>
      <Button
        EndIcon={PlusIcon}
        onClick={() => {
          setOpen(true);
        }}
        size="sm">
        Create segment
      </Button>

      <Modal
        className="md:w-full"
        closeOnOutsideClick={false}
        noPadding
        open={open}
        setOpen={() => {
          handleResetState();
        }}
        size="lg">
        <div className="rounded-lg bg-slate-50">
          <div className="rounded-t-lg bg-slate-100">
            <div className="flex w-full items-center gap-4 p-6">
              <div className="flex items-center space-x-2">
                <div className="mr-1.5 h-6 w-6 text-slate-500">
                  <UsersIcon className="h-5 w-5" />
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
                    className="w-auto"
                    onChange={(e) => {
                      setSegment((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }));
                    }}
                    placeholder="Ex. Power Users"
                  />
                </div>
              </div>

              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">Description</label>
                <Input
                  onChange={(e) => {
                    setSegment((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                  placeholder="Ex. Fully activated recurring users"
                />
              </div>
            </div>

            <label className="my-4 text-sm font-medium text-slate-900">Targeting</label>
            <div className="filter-scrollbar flex w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              {segment.filters.length === 0 && (
                <div className="-mb-2 flex items-center gap-1">
                  <FilterIcon className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-medium text-slate-700">Add your first filter to get started</h3>
                </div>
              )}

              <SegmentEditor
                actionClasses={actionClasses}
                attributeClasses={attributeClasses}
                environmentId={environmentId}
                group={segment.filters}
                segment={segment}
                segments={segments}
                setSegment={setSegment}
              />

              <Button
                className="w-fit"
                onClick={() => {
                  setAddFilterModalOpen(true);
                }}
                size="sm"
                variant="secondary">
                Add Filter
              </Button>

              <AddFilterModal
                actionClasses={actionClasses}
                attributeClasses={attributeClasses}
                onAddFilter={(filter) => {
                  handleAddFilterInGroup(filter);
                }}
                open={addFilterModalOpen}
                segments={segments}
                setOpen={setAddFilterModalOpen}
              />
            </div>

            <div className="flex justify-end pt-4">
              <div className="flex space-x-2">
                <Button
                  onClick={() => {
                    handleResetState();
                  }}
                  type="button"
                  variant="minimal">
                  Cancel
                </Button>
                <Button
                  disabled={isSaveDisabled}
                  loading={isCreatingSegment}
                  onClick={() => {
                    handleCreateSegment();
                  }}
                  type="submit">
                  Create segment
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
