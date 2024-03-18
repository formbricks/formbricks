"use client";

import { UsersIcon } from "lucide-react";
import { FilterIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { createSegmentAction } from "@formbricks/ee/advancedTargeting/lib/actions";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TBaseFilter, TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Modal } from "@formbricks/ui/Modal";
import BasicAddFilterModal from "@formbricks/ui/Targeting/BasicAddFilterModal";
import BasicSegmentEditor from "@formbricks/ui/Targeting/BasicSegmentEditor";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

type TCreateSegmentModalProps = {
  environmentId: string;
  attributeClasses: TAttributeClass[];
  isFormbricksCloud: boolean;
};
const BasicCreateSegmentModal = ({
  environmentId,
  attributeClasses,
  isFormbricksCloud,
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
  const [segment, setSegment] = useState<TSegment>(initialSegmentState);
  const [isCreatingSegment, setIsCreatingSegment] = useState(false);

  const handleResetState = () => {
    setSegment(initialSegmentState);
    setOpen(false);
  };

  const handleAddFilterInGroup = (filter: TBaseFilter) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment?.filters?.length === 0) {
      updatedSegment.filters.push({
        ...filter,
        connector: null,
      });
    } else {
      updatedSegment?.filters.push(filter);
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
                    placeholder="Ex. Power Users"
                    onChange={(e) => {
                      setSegment((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }));
                    }}
                    className="w-auto"
                  />
                </div>
              </div>

              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">Description</label>
                <Input
                  placeholder="Ex. Fully activated recurring users"
                  onChange={(e) => {
                    setSegment((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                  className="w-auto"
                />
              </div>
            </div>

            <label className="my-4 text-sm font-medium text-slate-900">Targeting</label>
            <div className="filter-scrollbar flex w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              {segment?.filters?.length === 0 && (
                <div className="-mb-2 flex items-center gap-1">
                  <FilterIcon className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-medium text-slate-700">Add your first filter to get started</h3>
                </div>
              )}

              <BasicSegmentEditor
                environmentId={environmentId}
                segment={segment}
                setSegment={setSegment}
                group={segment.filters}
                attributeClasses={attributeClasses}
              />

              <Button
                className="w-fit"
                variant="secondary"
                size="sm"
                onClick={() => setAddFilterModalOpen(true)}>
                Add Filter
              </Button>

              <BasicAddFilterModal
                onAddFilter={(filter) => {
                  handleAddFilterInGroup(filter);
                }}
                open={addFilterModalOpen}
                setOpen={setAddFilterModalOpen}
                attributeClasses={attributeClasses}
              />
            </div>

            {isFormbricksCloud ? (
              <UpgradePlanNotice
                message="For advanced targeting, please"
                textForUrl="upgrade to the User Identification plan."
                url={`/environments/${environmentId}/settings/billing`}
              />
            ) : (
              <UpgradePlanNotice
                message="For advanced targeting, please"
                textForUrl="request an Enterprise license."
                url="https://formbricks.com/docs/self-hosting/enterprise"
              />
            )}

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
                  disabled={isSaveDisabled}
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

export default BasicCreateSegmentModal;
