"use client";

import { FilterIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import type { TAttributeClass } from "@formbricks/types/attribute-classes";
import type { TBaseFilter, TSegment } from "@formbricks/types/segment";
import { ZSegmentFilters } from "@formbricks/types/segment";
import { Button } from "@formbricks/ui/components/Button";
import { Input } from "@formbricks/ui/components/Input";
import { Modal } from "@formbricks/ui/components/Modal";
import { createSegmentAction } from "../lib/actions";
import { AddFilterModal } from "./add-filter-modal";
import { SegmentEditor } from "./segment-editor";

interface TCreateSegmentModalProps {
  environmentId: string;
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
}

export function CreateSegmentModal({ environmentId, attributeClasses, segments }: TCreateSegmentModalProps) {
  const t = useTranslations();
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
      await createSegmentAction({
        title: segment.title,
        description: segment.description ?? "",
        isPrivate: segment.isPrivate,
        filters: segment.filters,
        environmentId,
        surveyId: "",
      });

      setIsCreatingSegment(false);
      toast.success(t("environments.segments.segment_saved_successfully"));
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
        {t("common.create_segment")}
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
                  <h3 className="text-base font-medium">{t("common.create_segment")}</h3>
                  <p className="text-sm text-slate-600">
                    {t(
                      "environments.segments.segments_help_you_target_users_with_same_characteristics_easily"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col overflow-auto rounded-lg bg-white p-6">
            <div className="flex w-full items-center gap-4">
              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">{t("common.title")}</label>
                <div className="relative flex flex-col gap-1">
                  <Input
                    className="w-auto"
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

            <label className="my-4 text-sm font-medium text-slate-900">{t("common.targeting")}</label>
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
                {t("common.add_filter")}
              </Button>

              <AddFilterModal
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
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
