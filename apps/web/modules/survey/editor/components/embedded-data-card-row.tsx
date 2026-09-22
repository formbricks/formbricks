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
import { FieldSourceIndicator, StatusIcon } from "@/modules/embedded-data/settings/components/field-status";
import { getDataTypeLabel } from "@/modules/embedded-data/settings/lib/field-labels";
import { type TEmbeddedFieldWarning } from "@/modules/survey/editor/lib/embedded-field-guards";
import { Alert } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { IdBadge } from "@/modules/ui/components/id-badge";

interface EmbeddedDataCardRowProps {
  entry: TLinkedEmbeddedField;
  /** Where the workspace library lists this field. Opened in a new tab so the editor is not left. */
  libraryHref: string;
  /** What is off about this field, from `embeddedFieldWarnings`. Never a reason to refuse a save. */
  warnings: TEmbeddedFieldWarning[];
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
  warnings,
  onEdit,
  onPromote,
  onCloneToLocal,
  onRemove,
}: Readonly<EmbeddedDataCardRowProps>) => {
  const { t } = useTranslation();
  const { field, link } = entry;
  const isShared = field.key !== null;
  const TypeIcon = EMBEDDED_FIELD_ICON_BY_DATA_TYPE[field.dataType];
  const typeLabel = getDataTypeLabel(field.dataType, t);

  /**
   * What a warning means, as a sentence. The branch is decided in `.ts`; the copy lives here because
   * `t()` calls have to be literal for the translation scanner to resolve them.
   */
  const describeWarning = (warning: TEmbeddedFieldWarning): string => {
    switch (warning) {
      case "unsafeAddress":
        return t("workspace.embedded_data.warning_unsafe_address");
      case "reservedAddress":
        return t("workspace.embedded_data.warning_reserved_address");
      case "systemParamAddress":
        return t("workspace.embedded_data.warning_system_param_address");
      case "clashingAddress":
        return t("workspace.embedded_data.warning_clashing_address");
      case "lockedWithoutDefault":
        return t("workspace.embedded_data.locked_without_default");
    }
  };

  return (
    <div
      // `border-slate-100`: the card around these rows already draws a `slate-200` hairline,
      // and the row's menu trigger draws a third inside that — one surface, one ring.
      className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3"
      data-testid="embedded-field-row"
      data-storage-key={link.storageKey}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* The row's only statement of what kind of value this is — the meta line below used to
              repeat it in words, which said the same thing twice in a row two lines tall. */}
          <StatusIcon icon={TypeIcon} label={typeLabel} />
          <span className="truncate text-sm font-medium text-slate-800">{field.name}</span>
          {/* The two owners used to be a `Badge` apiece, `info` against `gray` — which the Badge
              component renders with the identical slate palette, so the one difference an author
              needs to see was the wording. The library one carries the glyph its row menu and the
              settings page already use; the survey-owned one stays a plain pill. */}
          {isShared ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              <LibraryBigIcon className="size-3" aria-hidden="true" />
              {t("workspace.embedded_data.owner_library")}
            </span>
          ) : (
            <Badge text={t("workspace.embedded_data.owner_local")} type="gray" size="tiny" />
          )}
          {/* Only what locking does. That it has no default to fall back on is a warning below,
              where it is visible without hovering. */}
          {field.locked && (
            <StatusIcon
              icon={LockIcon}
              iconClassName="size-3.5"
              label={t("workspace.embedded_data.locked_description")}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <FieldSourceIndicator source={field.source} iconClassName="size-3.5" />
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {`${t("common.default")}: `}
            {field.defaultValue === null
              ? t("workspace.embedded_data.no_default")
              : String(field.defaultValue)}
          </span>
          <IdBadge id={link.storageKey} />
        </div>

        {/* Already on screen when the card opens, so `status` rather than the assertive default.
            Rendered as a plain child of `Alert`, not through `AlertDescription`: at `size="small"`
            that component carries `truncate`, which forces each sentence onto one line and clips it
            — and these sentences are the whole point of the row. */}
        {warnings.length > 0 && (
          <Alert variant="warning" size="small" role="status" data-testid="embedded-field-warning">
            <div className="flex flex-col gap-0.5">
              {warnings.map((warning) => (
                <span key={warning}>{describeWarning(warning)}</span>
              ))}
            </div>
          </Alert>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-white hover:bg-slate-100">
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
                  {t("workspace.embedded_data.open_library")}
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
