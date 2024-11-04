"use client";

import { FilterIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createSegmentAction } from "@formbricks/ee/advanced-targeting/lib/actions";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TBaseFilter, TSegment, ZSegmentFilters } from "@formbricks/types/segment";
import { BasicAddFilterModal } from "@formbricks/ui/components/BasicAddFilterModal";
import { BasicSegmentEditor } from "@formbricks/ui/components/BasicSegmentEditor";
import { Button } from "@formbricks/ui/components/Button";
import { Input } from "@formbricks/ui/components/Input";
import { Modal } from "@formbricks/ui/components/Modal";
import { UpgradePlanNotice } from "@formbricks/ui/components/UpgradePlanNotice";

type TCreateSegmentModalProps = {
  environmentId: string;
  attributeClasses: TAttributeClass[];
  isFormbricksCloud: boolean;
};

export const BasicCreateSegmentModal = ({
  environmentId,
  attributeClasses,
  isFormbricksCloud,
}: TCreateSegmentModalProps) => {
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
      toast.success(t("environments.segments.segment_created_successfully"));
    } catch (err: any) {
      // parse the segment filters to check if they are valid
      const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
      if (!parsedFilters.success) {
        toast.error(t("environments.segments.invalid_filters_please_check_the_filters_and_try_again"));
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

    if (!segment.title.trim()) {
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
      <Button size="sm" onClick={() => setOpen(true)} EndIcon={PlusIcon}>
        {t("common.create_segment")}
      </Button>

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
                    placeholder={t("environments.segments.ex_power_users")}
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
                <label className="text-sm font-medium text-slate-900">{t("common.description")}</label>
                <Input
                  placeholder={t("environments.segments.ex_fully_activated_recurring_users")}
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

            <label className="my-4 text-sm font-medium text-slate-900">{t("common.targeting")}</label>
            <div className="filter-scrollbar flex w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              {segment?.filters?.length === 0 && (
                <div className="-mb-2 flex items-center gap-1">
                  <FilterIcon className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-medium text-slate-700">
                    {t("environments.segments.add_your_first_filter_to_get_started")}
                  </h3>
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
                {t("common.add_filter")}
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
                message={t("environments.segments.for_advanced_targeting_please")}
                textForUrl={t("environments.segments.upgrade_your_plan")}
                url={`/environments/${environmentId}/settings/billing`}
              />
            ) : (
              <UpgradePlanNotice
                message={t("environments.segments.for_advanced_targeting_please")}
                textForUrl={t("common.request_an_enterprise_license")}
                url={`/environments/${environmentId}/settings/enterprise`}
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
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  loading={isCreatingSegment}
                  disabled={isSaveDisabled}
                  onClick={() => {
                    handleCreateSegment();
                  }}>
                  {t("common.create_segment")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
