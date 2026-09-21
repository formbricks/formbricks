"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getSharedEmbeddedDataAction } from "@/modules/embedded-data/actions";
import { FieldSourceIndicator } from "@/modules/embedded-data/settings/components/field-status";
import type { TSharedEmbeddedDataListItem } from "@/modules/embedded-data/types";
import {
  type TLinkableSharedField,
  listLinkableSharedFields,
} from "@/modules/survey/editor/lib/embedded-fields";
import { Button } from "@/modules/ui/components/button";
import { DataTypeBadge } from "@/modules/ui/components/data-type-badge";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Input } from "@/modules/ui/components/input";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface LibraryEmbeddedFieldsTabProps {
  workspaceId: string;
  /** The survey's fields as the editor holds them — what a row is offered against. */
  embeddedFields: readonly TLinkedEmbeddedField[];
  /** The survey's fields as stored — the baseline the clash guard grandfathers names against. */
  persistedFields: readonly TLinkedEmbeddedField[];
  onLink: (field: TLinkableSharedField) => void;
}

/**
 * The library half of the Add field dialog: the workspace's shared fields, minus the ones this
 * survey cannot take.
 *
 * Read through the same server action the workspace manager page uses, on mount rather than with
 * the editor, so a survey whose author never opens this never pays for the query — and so the list
 * is current rather than whatever it was when the editor loaded.
 *
 * **Which rows are offered is `listLinkableSharedFields`' answer, not this component's.** A row is
 * left out when the survey already links it, when its address is taken, or when adding it would put
 * one name in both the calculated and passed-in namespaces — the last of those decided by the same
 * guard, with the same grandfathering, that the save would apply.
 *
 * Laid out like `SavedActionsTab`: a search box over a scrolling list of pickable rows, because it
 * is the same choice — take one that already exists, or switch to the tab that makes a new one.
 */
export const LibraryEmbeddedFieldsTab = ({
  workspaceId,
  embeddedFields,
  persistedFields,
  onLink,
}: Readonly<LibraryEmbeddedFieldsTabProps>) => {
  const { t } = useTranslation();
  const [library, setLibrary] = useState<TSharedEmbeddedDataListItem[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const response = await getSharedEmbeddedDataAction({ workspaceId });
      if (!isCurrent) return;

      if (!response?.data) {
        toast.error(getFormattedErrorMessage(response) || t("common.something_went_wrong_please_try_again"));
        setLibrary([]);
        return;
      }

      setLibrary(response.data);
    };

    void load();
    return () => {
      isCurrent = false;
    };
  }, [workspaceId, t]);

  if (library === null) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const linkable = listLinkableSharedFields({ library, embeddedFields, persistedFields });
  const term = search.trim().toLowerCase();
  const matches = term
    ? linkable.filter(
        (field) =>
          field.name.toLowerCase().includes(term) ||
          field.key.toLowerCase().includes(term) ||
          field.description?.toLowerCase().includes(term)
      )
    : linkable;

  const renderRows = () => {
    if (matches.length === 0) {
      return (
        <EmptyState
          variant="simple"
          text={
            library.length === 0
              ? t("workspace.embedded_data.empty_state")
              : t("workspace.embedded_data.library_all_added")
          }
        />
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {matches.map((field) => (
          <div
            key={field.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
            data-testid="embedded-data-library-row">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-800">{field.name}</span>
                <IdBadge id={field.key} showCopyIconOnHover={true} />
              </div>
              {field.description && <p className="text-xs text-slate-500">{field.description}</p>}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <FieldSourceIndicator source={field.source} iconClassName="size-3.5" />
                <DataTypeBadge dataType={field.dataType} showIcon={false} />
              </div>
            </div>
            <Button size="sm" type="button" onClick={() => onLink(field)}>
              {t("common.add")}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Only once there is a list long enough to search: a search box over two rows is furniture. */}
      {linkable.length > 5 && (
        <Input
          type="text"
          id="search-embedded-data-library"
          className="mb-2 bg-white"
          placeholder={t("workspace.embedded_data.search_library")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      <div className="max-h-96 overflow-y-auto">{renderRows()}</div>
    </div>
  );
};
