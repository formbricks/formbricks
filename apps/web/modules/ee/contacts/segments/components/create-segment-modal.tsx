"use client";

import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createSegmentAction } from "@/modules/ee/contacts/segments/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { FilterIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type { TBaseFilter, TSegment } from "@formbricks/types/segment";
import { ZSegmentFilters } from "@formbricks/types/segment";
import { AddFilterModal } from "./add-filter-modal";
import { SegmentEditor } from "./segment-editor";

interface TCreateSegmentModalProps {
  environmentId: string;
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
}

export function CreateSegmentModal({
  environmentId,
  contactAttributeKeys,
  segments,
}: TCreateSegmentModalProps) {
  const { t } = useTranslate();
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
      toast.error(t("environments.segments.title_is_required"));
      return;
    }

    try {
      setIsCreatingSegment(true);
      const createSegmentResponse = await createSegmentAction({
        title: segment.title,
        description: segment.description ?? "",
        isPrivate: segment.isPrivate,
        filters: segment.filters,
        environmentId,
        surveyId: "",
      });

      if (createSegmentResponse?.data) {
        toast.success(t("environments.segments.segment_saved_successfully"));
        handleResetState();
        router.refresh();
        setIsCreatingSegment(false);
      } else {
        const errorMessage = getFormattedErrorMessage(createSegmentResponse);
        toast.error(errorMessage);
        setIsCreatingSegment(false);
      }
    } catch (err: any) {
      // parse the segment filters to check if they are valid
      const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
      if (!parsedFilters.success) {
        toast.error(t("environments.segments.invalid_segment_filters"));
      } else {
        toast.error(t("common.something_went_wrong_please_try_again"));
      }
      setIsCreatingSegment(false);
      return;
    }
  };

  const isSaveDisabled = useMemo(() => {
    // check if title is empty

    if (!segment.title || segment.title.trim() === "") {
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
        onClick={() => {
          setOpen(true);
        }}
        size="sm">
        {t("common.create_segment")}
        <PlusIcon />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(open) => {
          if (!open) {
            handleResetState();
          }
        }}>
        <DialogContent className="sm:max-w-4xl" disableCloseOnOutsideClick>
          <DialogHeader>
            <UsersIcon />
            <DialogTitle>{t("common.create_segment")}</DialogTitle>
            <DialogDescription>
              {t("environments.segments.segments_help_you_target_users_with_same_characteristics_easily")}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="flex w-full items-center gap-4">
              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">{t("common.title")}</label>
                <div className="relative flex flex-col gap-1">
                  <Input
                    className="w-auto"
                    value={segment.title}
                    onChange={(e) => {
                      setSegment((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }));
                    }}
                    placeholder={t("environments.segments.ex_power_users")}
                  />
                </div>
              </div>

              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">{t("common.description")}</label>
                <Input
                  value={segment.description ?? ""}
                  onChange={(e) => {
                    setSegment((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                  placeholder={t("environments.segments.ex_fully_activated_recurring_users")}
                />
              </div>
            </div>
            <div className="flex flex-col gap-y-2 pt-4">
              <label className="text-sm font-medium text-slate-900">{t("common.targeting")}</label>
              <div className="filter-scrollbar flex w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                {segment.filters.length === 0 && (
                  <div className="-mb-2 flex items-center gap-1">
                    <FilterIcon className="h-5 w-5 text-slate-700" />
                    <h3 className="text-sm font-medium text-slate-700">
                      {t("environments.segments.add_your_first_filter_to_get_started")}
                    </h3>
                  </div>
                )}

                <SegmentEditor
                  contactAttributeKeys={contactAttributeKeys}
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
                  {t("common.add_filter")}
                </Button>

                <AddFilterModal
                  contactAttributeKeys={contactAttributeKeys}
                  onAddFilter={(filter) => {
                    handleAddFilterInGroup(filter);
                  }}
                  open={addFilterModalOpen}
                  segments={segments}
                  setOpen={setAddFilterModalOpen}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              onClick={() => {
                handleResetState();
              }}
              type="button"
              variant="secondary">
              {t("common.cancel")}
            </Button>
            <Button
              disabled={isSaveDisabled}
              loading={isCreatingSegment}
              onClick={() => {
                handleCreateSegment();
              }}
              type="submit">
              {t("common.create_segment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
