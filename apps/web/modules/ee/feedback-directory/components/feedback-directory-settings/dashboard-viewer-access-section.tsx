"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  type TDatasetViewerAccessResource,
  dashboardAccessQueryKeys,
  getDatasetViewerAccess,
  replaceDatasetViewerAccess,
} from "@/modules/ee/dashboard-access/lib/api-client";
import {
  type TViewerAccessJoin,
  VIEWER_ACCESS_EMBEDDED_PREFIX,
  VIEWER_ACCESS_MAX_CONDITIONS,
  VIEWER_ACCESS_RECORD_FIELDS,
  getViewerAccessEmbeddedKey,
} from "@/modules/ee/dashboard-access/lib/viewer-access-fields";
import { listMemberAttributeKeys } from "@/modules/ee/member-attributes/lib/api-client";
import { memberAttributeKeys } from "@/modules/ee/member-attributes/lib/query";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Muted } from "@/modules/ui/components/typography";

/** The Email attribute in the attribute picker: conditions store it as `attributeKeyId: null`. */
const EMAIL_VALUE = "__email__";
/** The "Embedded data" choice in the field picker; the key is typed next to it. */
const EMBEDDED_VALUE = "__embedded__";

type TDraftCondition = { id: string; field: string; attributeKeyId: string | null };
type TDraft = { join: TViewerAccessJoin; conditions: TDraftCondition[] };

const toDraft = (access: TDatasetViewerAccessResource): TDraft => ({
  join: access.join,
  conditions: access.conditions.map(({ field, attributeKeyId }, index) => ({
    id: `${index}`,
    field,
    attributeKeyId,
  })),
});

const sameDraft = (a: TDraft, b: TDraft) =>
  a.join === b.join &&
  a.conditions.length === b.conditions.length &&
  a.conditions.every(
    (condition, index) =>
      condition.field === b.conditions[index].field &&
      condition.attributeKeyId === b.conditions[index].attributeKeyId
  );

interface DashboardViewerAccessSectionProps {
  datasetId: string;
  organizationId: string;
  /** Owners and Managers, decided on the server. */
  canEdit: boolean;
}

/**
 * "Dashboard Viewer access" in a Feedback Dataset's settings (ENG-7476): the conditions a record must meet
 * for a Dashboard Viewer to see it. Saved on its own, with the dataset's version, so a concurrent change
 * is reported instead of overwritten.
 */
export const DashboardViewerAccessSection = ({
  datasetId,
  organizationId,
  canEdit,
}: Readonly<DashboardViewerAccessSectionProps>) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sectionId = useId();

  const accessQuery = useQuery({
    queryKey: dashboardAccessQueryKeys.dataset(datasetId),
    queryFn: ({ signal }) => getDatasetViewerAccess(datasetId, signal),
  });
  const keysQuery = useQuery({
    queryKey: memberAttributeKeys.keys(organizationId),
    queryFn: ({ signal }) => listMemberAttributeKeys(organizationId, signal),
  });

  // The edit in progress; `null` while it matches what the server holds.
  const [draft, setDraft] = useState<TDraft | null>(null);
  const saved = useMemo(() => (accessQuery.data ? toDraft(accessQuery.data) : null), [accessQuery.data]);
  const current = draft ?? saved;
  const isDirty = draft !== null && saved !== null && !sameDraft(draft, saved);

  const save = useMutation({
    mutationFn: (value: TDraft) =>
      replaceDatasetViewerAccess(datasetId, {
        join: value.join,
        conditions: value.conditions.map(({ field, attributeKeyId }) => ({ field, attributeKeyId })),
        expectedUpdatedAt: accessQuery.data?.updatedAt ?? "",
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(dashboardAccessQueryKeys.dataset(datasetId), data);
      setDraft(null);
      toast.success(t("workspace.settings.feedback_directories.dashboard_viewer_access_saved"));
    },
    onError: (error) => {
      if (error instanceof V3ApiError && error.status === 409) {
        toast.error(t("workspace.settings.feedback_directories.dashboard_viewer_access_conflict"));
        setDraft(null);
        void queryClient.invalidateQueries({ queryKey: dashboardAccessQueryKeys.dataset(datasetId) });
        return;
      }
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    },
  });

  if (accessQuery.isError) return null;

  const update = (next: TDraft) => setDraft(next);
  const updateCondition = (id: string, change: Partial<TDraftCondition>) => {
    if (!current) return;
    update({
      ...current,
      conditions: current.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...change } : condition
      ),
    });
  };
  const addCondition = () => {
    if (!current) return;
    update({
      ...current,
      conditions: [
        ...current.conditions,
        { id: `new-${Date.now()}`, field: "FeedbackRecords.sourceName", attributeKeyId: null },
      ],
    });
  };
  const removeCondition = (id: string) => {
    if (!current) return;
    update({ ...current, conditions: current.conditions.filter((condition) => condition.id !== id) });
  };

  const disabled = !canEdit || save.isPending || !current;
  const hasInvalidField = current?.conditions.some(
    ({ field }) => (getViewerAccessEmbeddedKey(field) ?? "x").trim().length === 0
  );

  return (
    <div className="space-y-3" aria-labelledby={`${sectionId}-title`}>
      <div className="space-y-1">
        <Label id={`${sectionId}-title`}>
          {t("workspace.settings.feedback_directories.dashboard_viewer_access")}
        </Label>
        <Muted className="block text-slate-500">
          {t("workspace.settings.feedback_directories.dashboard_viewer_access_description")}
        </Muted>
        {current && current.conditions.length === 0 && (
          <Muted className="block text-slate-500">
            {t("workspace.settings.feedback_directories.dashboard_viewer_access_no_conditions")}
          </Muted>
        )}
      </div>

      {current && current.conditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span>{t("workspace.settings.feedback_directories.dashboard_viewer_access_show_when")}</span>
          <Select
            value={current.join}
            onValueChange={(value) => update({ ...current, join: value as TViewerAccessJoin })}
            disabled={disabled}>
            <SelectTrigger
              className="h-8 w-auto bg-white"
              aria-label={t("workspace.settings.feedback_directories.dashboard_viewer_access_join_label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("workspace.settings.feedback_directories.dashboard_viewer_access_join_all")}
              </SelectItem>
              <SelectItem value="any">
                {t("workspace.settings.feedback_directories.dashboard_viewer_access_join_any")}
              </SelectItem>
            </SelectContent>
          </Select>
          <span>
            {t("workspace.settings.feedback_directories.dashboard_viewer_access_of_these_are_true")}
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {current?.conditions.map((condition) => {
          const embeddedKey = getViewerAccessEmbeddedKey(condition.field);
          return (
            <li key={condition.id} className="flex flex-wrap items-center gap-2">
              <Select
                value={embeddedKey === null ? condition.field : EMBEDDED_VALUE}
                onValueChange={(value) =>
                  updateCondition(condition.id, {
                    field: value === EMBEDDED_VALUE ? VIEWER_ACCESS_EMBEDDED_PREFIX : value,
                  })
                }
                disabled={disabled}>
                <SelectTrigger
                  className="h-9 w-44 bg-white"
                  aria-label={t(
                    "workspace.settings.feedback_directories.dashboard_viewer_access_dataset_field"
                  )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VIEWER_ACCESS_RECORD_FIELDS).map(([field, label]) => (
                    <SelectItem key={field} value={field}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectItem value={EMBEDDED_VALUE}>
                    {t("workspace.settings.feedback_directories.dashboard_viewer_access_embedded_data")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {embeddedKey !== null && (
                <Input
                  className="h-9 w-36"
                  value={embeddedKey}
                  maxLength={255}
                  onChange={(event) =>
                    updateCondition(condition.id, {
                      field: `${VIEWER_ACCESS_EMBEDDED_PREFIX}${event.target.value}`,
                    })
                  }
                  placeholder={t(
                    "workspace.settings.feedback_directories.dashboard_viewer_access_embedded_key"
                  )}
                  aria-label={t(
                    "workspace.settings.feedback_directories.dashboard_viewer_access_embedded_key"
                  )}
                  disabled={disabled}
                />
              )}
              <span className="text-sm text-slate-500">
                {t("workspace.settings.feedback_directories.dashboard_viewer_access_equals")}
              </span>
              <Select
                value={condition.attributeKeyId ?? EMAIL_VALUE}
                onValueChange={(value) =>
                  updateCondition(condition.id, { attributeKeyId: value === EMAIL_VALUE ? null : value })
                }
                disabled={disabled}>
                <SelectTrigger
                  className="h-9 w-56 bg-white"
                  aria-label={t(
                    "workspace.settings.feedback_directories.dashboard_viewer_access_member_attribute"
                  )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMAIL_VALUE}>
                    {t("workspace.settings.feedback_directories.dashboard_viewer_access_viewer_attribute", {
                      attribute: t("common.email"),
                    })}
                  </SelectItem>
                  {(keysQuery.data ?? []).map((key) => (
                    <SelectItem key={key.id} value={key.id}>
                      {t("workspace.settings.feedback_directories.dashboard_viewer_access_viewer_attribute", {
                        attribute: key.label,
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(condition.id)}
                  disabled={disabled}
                  aria-label={t("workspace.settings.feedback_directories.dashboard_viewer_access_remove")}>
                  <TrashIcon className="size-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addCondition}
            disabled={disabled || (current?.conditions.length ?? 0) >= VIEWER_ACCESS_MAX_CONDITIONS}>
            <PlusIcon className="size-4" />
            {t("workspace.settings.feedback_directories.dashboard_viewer_access_add_condition")}
          </Button>
          {isDirty && draft && (
            <Button
              type="button"
              size="sm"
              loading={save.isPending}
              disabled={disabled || hasInvalidField}
              onClick={() => save.mutate(draft)}>
              {t("workspace.settings.feedback_directories.dashboard_viewer_access_save")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
