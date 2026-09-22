"use client";

import {
  CopyPlusIcon,
  ExternalLinkIcon,
  LibraryBigIcon,
  LockIcon,
  MoreVertical,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { EMBEDDED_FIELD_ICON_BY_DATA_TYPE } from "@/modules/embedded-data/lib/field-display";
import { FieldSourceIcon } from "@/modules/embedded-data/settings/components/field-source-icon";
import { getDataTypeLabel, getSourceLabel } from "@/modules/embedded-data/settings/lib/field-labels";
import { Badge } from "@/modules/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface EmbeddedDataCardRowProps {
  entry: TLinkedEmbeddedField;
  /** Where the workspace library lists this field. Opened in a new tab so the editor is not left. */
  libraryHref: string;
  onEdit: () => void;
  onPromote: () => void;
  onCloneToLocal: () => void;
  onRemove: () => void;
}

/**
 * One Embedded Data field, as the editor's card lists it.
 *
 * Two lines rather than a table: the card sits in the editor's two-thirds panel, where a seven-column
 * table of the workspace manager's shape would elide every value in it. The name and who owns the
 * definition lead, because those are what an author scans for; what the field *is* — source, type,
 * default, the address its value is stored under — follows underneath.
 *
 * **The address is read-only, and shown anyway.** It is the URL parameter an ingested field is filled
 * from and the id a computed field's recall tokens carry, so an author needs to be able to copy it
 * while never being able to change it: responses already collected are stored under it.
 *
 * Which actions a row offers is decided by **who owns the definition**, not by a flag: a field this
 * survey owns can be edited here and lifted into the library, a library field can only be copied,
 * opened where it lives, or dropped from this survey.
 */
export const EmbeddedDataCardRow = ({
  entry,
  libraryHref,
  onEdit,
  onPromote,
  onCloneToLocal,
  onRemove,
}: Readonly<EmbeddedDataCardRowProps>) => {
  const { t } = useTranslation();
  const { field, link } = entry;
  const isShared = field.key !== null;
  const TypeIcon = EMBEDDED_FIELD_ICON_BY_DATA_TYPE[field.dataType];

  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
      data-testid="embedded-field-row"
      data-storage-key={link.storageKey}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeIcon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="truncate text-sm font-medium text-slate-800">{field.name}</span>
          <Badge
            text={
              isShared ? t("workspace.embedded_data.owner_library") : t("workspace.embedded_data.owner_local")
            }
            type={isShared ? "info" : "gray"}
            size="tiny"
          />
          {field.locked && (
            <TooltipRenderer
              tooltipContent={
                field.defaultValue === null
                  ? t("workspace.embedded_data.locked_without_default")
                  : t("workspace.embedded_data.locked_description")
              }>
              <LockIcon
                className="size-3.5 shrink-0 text-slate-500"
                aria-label={t("workspace.embedded_data.locked")}
              />
            </TooltipRenderer>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <FieldSourceIcon source={field.source} className="size-3.5" />
            {getSourceLabel(field.source, t)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">{getDataTypeLabel(field.dataType, t)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {`${t("common.default")}: `}
            {field.defaultValue === null
              ? t("workspace.embedded_data.no_default")
              : String(field.defaultValue)}
          </span>
          <IdBadge id={link.storageKey} showCopyIconOnHover={true} />
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50">
          {/* Names the field, so a screen reader hears which row's menu this opens. */}
          <span className="sr-only">{`${t("workspace.surveys.open_options")} – ${field.name}`}</span>
          <MoreVertical className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="inline-block w-auto min-w-max">
          <DropdownMenuGroup>
            {isShared ? (
              <>
                <DropdownMenuItem icon={<CopyPlusIcon className="size-4" />} onSelect={onCloneToLocal}>
                  {t("workspace.embedded_data.edit_a_copy")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<ExternalLinkIcon className="size-4" />}
                  onSelect={() => window.open(libraryHref, "_blank", "noopener,noreferrer")}>
                  {t("workspace.embedded_data.open_in_library")}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem icon={<SquarePenIcon className="size-4" />} onSelect={onEdit}>
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem icon={<LibraryBigIcon className="size-4" />} onSelect={onPromote}>
                  {t("workspace.embedded_data.add_to_library")}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem icon={<Trash2Icon className="size-4" />} onSelect={onRemove}>
              {t("common.remove")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
