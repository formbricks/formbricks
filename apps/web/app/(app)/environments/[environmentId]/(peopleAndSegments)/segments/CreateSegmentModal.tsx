"use client";

import AddFilterModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/AddFilterModal";
import SegmentFilters from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/SegmentFilters";
import { TBaseFilterGroupItem, TUserSegment } from "@formbricks/types/v1/userSegment";
import { Button, Dialog, DialogContent, Input } from "@formbricks/ui";
import { UserGroupIcon } from "@heroicons/react/20/solid";
import { produce } from "immer";
import { useState } from "react";

const CreateSegmentModal = ({ environmentId }: { environmentId: string }) => {
  const [open, setOpen] = useState(false);
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [userSegment, setUserSegment] = useState<TUserSegment>({
    title: "",
    description: "",
    isPrivate: false,
    filters: [],
    environmentId,
    id: "",
    surveys: [],
  });

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

  return (
    <>
      <div className="mb-4 text-end">
        <Button variant="darkCTA" onClick={() => setOpen(true)}>
          Create Segment
        </Button>
      </div>

      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="relative overflow-hidden bg-slate-50 sm:!max-w-2xl" hideCloseButton>
            <div className="absolute left-0 right-0 top-0 h-16 bg-slate-200 p-4">
              <div className="flex items-center gap-4">
                <UserGroupIcon className="h-6 w-6" />

                <div className="flex flex-col">
                  <h3 className="text-base font-medium">Create Segment</h3>

                  <p className="text-xs text-slate-600">
                    Segments help you target the users with the same characteristics easily.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-16 flex flex-col rounded-lg">
              <div className="flex w-full items-center gap-4">
                <div className="flex w-1/2 flex-col gap-2">
                  <label className="text-sm font-medium text-slate-900">Title</label>
                  <Input placeholder="Ex. Power Users" />
                </div>

                <div className="flex w-1/2 flex-col gap-2">
                  <label className="text-sm font-medium text-slate-900">Description</label>
                  <Input placeholder="Ex. Fully activated recurring users" />
                </div>
              </div>

              <label className="my-4 text-sm font-medium text-slate-900">Targeting</label>
              <div className="flex flex-col gap-4 rounded-lg border border-slate-700 p-4">
                <SegmentFilters
                  environmentId={environmentId}
                  userSegment={userSegment}
                  setUserSegment={setUserSegment}
                  group={userSegment.filters}
                />

                <AddFilterModal
                  environmentId={environmentId}
                  onAddFilter={(filter) => {
                    handleAddFilterInGroup(filter);
                  }}
                  open={addFilterModalOpen}
                  setOpen={setAddFilterModalOpen}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default CreateSegmentModal;
