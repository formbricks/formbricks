"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { EmbeddedFieldForm } from "@/modules/survey/editor/components/embedded-field-form";
import { LibraryEmbeddedFieldsTab } from "@/modules/survey/editor/components/library-embedded-fields-tab";
import { type TLinkableSharedField } from "@/modules/survey/editor/lib/embedded-fields";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface AddEmbeddedFieldModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspaceId: string;
  /** The survey's fields as the editor holds them. */
  embeddedFields: readonly TLinkedEmbeddedField[];
  /** The survey's fields as stored — the baseline the clash guard grandfathers names against. */
  persistedFields: readonly TLinkedEmbeddedField[];
  /** Ids already spoken for in the survey's namespace: its elements and ending cards. */
  takenIds: string[];
  /** The addresses this survey's fields occupy. */
  takenStorageKeys: string[];
  /** Every declared name — what makes a repeat a duplicate. */
  otherFieldNames: string[];
  locale: string;
  responseCount: number;
  onLink: (field: TLinkableSharedField) => void;
  onCreate: (entry: TLinkedEmbeddedField) => void;
}

/**
 * **Add field**, the card's one way in — the Actions dialog's shape, for the same choice.
 *
 * Adding a trigger and adding an Embedded Data field are the same decision twice: take the one the
 * workspace already defines, or make one here. Actions has answered it with a single button opening
 * a two-tab dialog since long before Embedded Data existed, and this card was answering it with two
 * competing buttons of its own — a primary "New field" beside a secondary "Add from library" — which
 * made the same choice look like a different kind of thing.
 *
 * So: one secondary control in the card, the library first (the cheaper answer, and the one that
 * keeps definitions shared), and the create form second. The tab strip is `add-action-modal.tsx`'s,
 * deliberately down to its markup.
 */
export const AddEmbeddedFieldModal = ({
  open,
  setOpen,
  workspaceId,
  embeddedFields,
  persistedFields,
  takenIds,
  takenStorageKeys,
  otherFieldNames,
  locale,
  responseCount,
  onLink,
  onCreate,
}: Readonly<AddEmbeddedFieldModalProps>) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      title: t("workspace.embedded_data.select_library_field"),
      children: (
        <LibraryEmbeddedFieldsTab
          workspaceId={workspaceId}
          embeddedFields={embeddedFields}
          persistedFields={persistedFields}
          onLink={onLink}
        />
      ),
    },
    {
      title: t("workspace.embedded_data.create_new_field"),
      children: (
        <EmbeddedFieldForm
          entry={null}
          takenIds={takenIds}
          takenStorageKeys={takenStorageKeys}
          otherFieldNames={otherFieldNames}
          locale={locale}
          // A field that does not exist yet has no stored type and nothing to reinterpret, so the
          // retyping question this pair drives can never be asked from here.
          storedDataType={null}
          responseCount={responseCount}
          onSubmitField={onCreate}
          onCancel={() => setOpen(false)}
        />
      ),
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpen(false);
      }}>
      <DialogContent disableCloseOnOutsideClick>
        <DialogHeader>
          <DialogTitle>{t("workspace.embedded_data.add_field")}</DialogTitle>
          <DialogDescription>{t("workspace.embedded_data.add_field_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex h-full w-full items-center justify-center gap-x-2 border-b border-slate-200 px-6">
            {tabs.map((tab, index) => (
              <button
                type="button"
                key={tab.title}
                className={`mr-4 px-1 pb-3 focus:outline-hidden ${
                  activeTab === index
                    ? "border-b-2 border-brand-dark font-semibold text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => setActiveTab(index)}>
                {tab.title}
              </button>
            ))}
          </div>
          <div className="flex-1 pt-4">{tabs[activeTab].children}</div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
