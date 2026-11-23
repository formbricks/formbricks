"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { ShieldUserIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { ListTable } from "@/modules/ui/components/table-toolbar";
import { useMemberAttributeKeys } from "../hooks/use-member-attributes";
import type { TMemberAttributeKeyItem } from "../lib/api-client";
import { MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION } from "../lib/limits";
import { AttributeKeyDialog } from "./attribute-key-dialog";

type TAttributeTableRow = { kind: "email" } | { kind: "key"; key: TMemberAttributeKeyItem };

const getAttributeKeyColumns = (t: TFunction): ColumnDef<TAttributeTableRow>[] => [
  {
    id: "label",
    header: t("common.label"),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <ShieldUserIcon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span className="truncate font-medium text-slate-900">
          {row.original.kind === "email" ? t("common.email") : row.original.key.label}
        </span>
        {row.original.kind === "email" && (
          <Badge size="tiny" type="gray" text={t("workspace.settings.member_attributes.built_in")} />
        )}
      </div>
    ),
  },
  {
    id: "key",
    header: t("common.key"),
    cell: ({ row }) => (
      <IdBadge id={row.original.kind === "email" ? "email" : row.original.key.key} showCopyIconOnHover />
    ),
  },
  {
    id: "values",
    header: t("workspace.settings.member_attributes.values"),
    cell: ({ row }) => (
      <span className="text-slate-600">
        {row.original.kind === "email"
          ? t("workspace.settings.member_attributes.one_value")
          : t("workspace.settings.member_attributes.several_values")}
      </span>
    ),
  },
  {
    id: "setFor",
    header: t("workspace.settings.member_attributes.set_for"),
    cell: ({ row }) => (
      <span className="text-slate-600">
        {row.original.kind === "email"
          ? t("workspace.settings.member_attributes.all_members")
          : t("workspace.settings.member_attributes.member_count", {
              count: row.original.key.memberCount,
            })}
      </span>
    ),
  },
];

/**
 * Organization settings' Member attributes section (ENG-7474): the built-in Email first (not editable),
 * then the organization's keys. Owners and Managers create, edit and delete them; the data comes from the
 * v3 key list.
 */
export const MemberAttributesSection = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const { t } = useTranslation();
  const query = useMemberAttributeKeys({ organizationId });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TMemberAttributeKeyItem | null>(null);
  const keys = query.data;

  const rows = useMemo<TAttributeTableRow[]>(
    () => [{ kind: "email" }, ...(keys ?? []).map((key) => ({ kind: "key" as const, key }))],
    [keys]
  );

  const columns = useMemo(() => getAttributeKeyColumns(t), [t]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => (row.kind === "email" ? "email" : row.key.id),
    getCoreRowModel: getCoreRowModel(),
  });

  const atLimit = (keys?.length ?? 0) >= MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION;

  return (
    <SettingsCard
      title={t("workspace.settings.member_attributes.title")}
      description={t("workspace.settings.member_attributes.attribute_count", { count: rows.length })}
      bodyVariant="flush"
      cta={
        <Button
          variant="secondary"
          size="sm"
          disabled={atLimit || !keys}
          onClick={() => setIsCreateOpen(true)}>
          {t("workspace.settings.member_attributes.create_attribute")}
        </Button>
      }>
      {query.isError ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-sm text-slate-600">
          <p>{getV3ApiErrorMessage(query.error, t("common.something_went_wrong_please_try_again"))}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t("common.try_again")}
          </Button>
        </div>
      ) : (
        <ListTable
          table={table}
          testId="member-attributes-table"
          isLoading={query.isLoading}
          hasFilters={false}
          onClearFilters={() => undefined}
          isRowClickable={(row) => row.original.kind === "key"}
          onRowClick={(row) => {
            if (row.original.kind === "key") setEditing(row.original.key);
          }}
        />
      )}
      {isCreateOpen && (
        <AttributeKeyDialog organizationId={organizationId} open={isCreateOpen} setOpen={setIsCreateOpen} />
      )}
      {editing && (
        <AttributeKeyDialog
          key={editing.id}
          organizationId={organizationId}
          open
          attributeKey={editing}
          setOpen={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </SettingsCard>
  );
};
