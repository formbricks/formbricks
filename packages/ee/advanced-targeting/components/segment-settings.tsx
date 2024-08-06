"use client";

import { FilterIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import type { TActionClass } from "@formbricks/types/action-classes";
import type { TAttributeClass } from "@formbricks/types/attribute-classes";
import type { TBaseFilter, TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { ZSegmentFilters } from "@formbricks/types/segment";
import { Button } from "@formbricks/ui/Button";
import { ConfirmDeleteSegmentModal } from "@formbricks/ui/ConfirmDeleteSegmentModal";
import { Input } from "@formbricks/ui/Input";
import { deleteSegmentAction, updateSegmentAction } from "../lib/actions";
import { AddFilterModal } from "./add-filter-modal";
import { SegmentEditor } from "./segment-editor";

interface TSegmentSettingsTabProps {
  environmentId: string;
  setOpen: (open: boolean) => void;
  initialSegment: TSegmentWithSurveyNames;
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
}

export function SegmentSettings({
  environmentId,
  initialSegment,
  setOpen,
  actionClasses,
  attributeClasses,
  segments,
}: TSegmentSettingsTabProps) {
  const router = useRouter();

  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [segment, setSegment] = useState<TSegment>(initialSegment);

  const [isUpdatingSegment, setIsUpdatingSegment] = useState(false);
  const [isDeletingSegment, setIsDeletingSegment] = useState(false);

  const [isDeleteSegmentModalOpen, setIsDeleteSegmentModalOpen] = useState(false);

  const handleResetState = () => {
    setSegment(initialSegment);
    setOpen(false);

    router.refresh();
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

  const handleUpdateSegment = async () => {
    if (!segment.title) {
      toast.error("Title is required");
      return;
    }

    try {
      setIsUpdatingSegment(true);
      await updateSegmentAction(segment.environmentId, segment.id, {
        title: segment.title,
        description: segment.description ?? "",
        isPrivate: segment.isPrivate,
        filters: segment.filters,
      });

      setIsUpdatingSegment(false);
      toast.success("Segment updated successfully!");
    } catch (err: any) {
      const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
      if (!parsedFilters.success) {
        toast.error("Invalid filters. Please check the filters and try again.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
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
      await deleteSegmentAction(segment.environmentId, segment.id);

      setIsDeletingSegment(false);
      toast.success("Segment deleted successfully!");
      handleResetState();
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    }

    setIsDeletingSegment(false);
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
    <div className="mb-4">
      <div className="rounded-lg bg-slate-50">
        <div className="flex flex-col overflow-auto rounded-lg bg-white">
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
                  value={segment.title}
                />
              </div>
            </div>

            <div className="flex w-1/2 flex-col gap-2">
              <label className="text-sm font-medium text-slate-900">Description</label>
              <div className="relative flex flex-col gap-1">
                <Input
                  className={cn("w-auto")}
                  onChange={(e) => {
                    setSegment((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                  placeholder="Ex. Power Users"
                  value={segment.description ?? ""}
                />
              </div>
            </div>
          </div>

          <label className="my-4 text-sm font-medium text-slate-900">Targeting</label>
          <div className="filter-scrollbar flex max-h-96 w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
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

            <div>
              <Button
                onClick={() => {
                  setAddFilterModalOpen(true);
                }}
                size="sm"
                variant="secondary">
                Add Filter
              </Button>
            </div>

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

          <div className="flex w-full items-center justify-between pt-4">
            <Button
              EndIcon={Trash2}
              endIconClassName="p-0.5"
              loading={isDeletingSegment}
              onClick={() => {
                setIsDeleteSegmentModalOpen(true);
              }}
              type="button"
              variant="warn">
              Delete
            </Button>
            <Button
              disabled={isSaveDisabled}
              loading={isUpdatingSegment}
              onClick={() => {
                handleUpdateSegment();
              }}
              type="submit">
              Save changes
            </Button>

            {isDeleteSegmentModalOpen ? (
              <ConfirmDeleteSegmentModal
                onDelete={handleDeleteSegment}
                open={isDeleteSegmentModalOpen}
                segment={initialSegment}
                setOpen={setIsDeleteSegmentModalOpen}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
