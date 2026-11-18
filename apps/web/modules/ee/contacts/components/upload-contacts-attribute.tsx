"use client";

import { createId } from "@paralleldrive/cuid2";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { isSafeIdentifier } from "@formbricks/types/safe-identifier";
import { UploadContactsAttributeCombobox } from "@/modules/ee/contacts/components/upload-contacts-attribute-combobox";
import { Badge } from "@/modules/ui/components/badge";

interface UploadContactsAttributesProps {
  readonly attributeMap: Record<string, string>;
  readonly setAttributeMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  readonly contactAttributeKeys: TContactAttributeKey[];
  readonly csvColumn: string;
}

export const UploadContactsAttributes = ({
  attributeMap,
  contactAttributeKeys,
  setAttributeMap,
  csvColumn,
}: UploadContactsAttributesProps) => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = useState(false);

  // Initialize tags from contact attribute keys
  const [keys, setKeys] = useState(
    contactAttributeKeys.map((attrKey) => ({
      label: attrKey.name ?? attrKey.key,
      value: attrKey.id,
    }))
  );

  // Create a mapping of attribute IDs to their names/keys
  const attributeKeyMap: Record<string, string> = useMemo(() => {
    return keys.reduce<Record<string, string>>((acc, tag) => {
      acc[tag.value] = tag.label;
      return acc;
    }, {});
  }, [keys]);

  // The selected key follows the attribute map: the one this column maps to, or a key made from the
  // mapped value when it matches none of the known ones.
  const mappedValue = attributeMap[csvColumn];
  const currentKey: { label: string; value: string } | null = mappedValue
    ? (keys.find((tag) => tag.value === mappedValue) ?? {
        label: attributeKeyMap[mappedValue] || mappedValue,
        value: mappedValue,
      })
    : null;

  // Only a key that does not exist yet and is a valid safe identifier (can actually be created) is new.
  const isNewTag =
    currentKey !== null &&
    contactAttributeKeys.findIndex((attrKey) => attrKey.id === currentKey.value) === -1 &&
    !!mappedValue &&
    isSafeIdentifier(mappedValue);

  const handleAddAttribute = (value: string) => {
    // Find the tag that matches the selected value
    const selectedTag = keys.find((tag) => tag.value === value);
    if (!selectedTag) return;

    // Update the attributeMap
    setAttributeMap((prev) => ({
      ...prev,
      [csvColumn]: value,
    }));
  };

  const handleCreateTag = (value: string) => {
    const cuid = createId();
    const newTag = {
      label: value, // This is the display text entered by the user
      value: cuid, // This is the ID we generate
    };

    // Add the new tag to the tags list
    setKeys((prev) => [...prev, newTag]);

    // Update the attribute map with the ID
    setAttributeMap((prev) => ({
      ...prev,
      [csvColumn]: value.trim(),
    }));

    // Close the combobox and clear search
    setOpen(false);
    setSearchValue("");
  };

  return (
    <>
      <span className="overflow-hidden font-medium text-ellipsis text-slate-700">{csvColumn}</span>
      <div className="flex items-center gap-2">
        <UploadContactsAttributeCombobox
          open={open}
          setOpen={setOpen}
          addKey={handleAddAttribute}
          currentKey={currentKey}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          keys={keys}
          createKey={handleCreateTag}
        />

        {isNewTag ? (
          <Badge
            size="normal"
            type="success"
            className="rounded-md"
            text={t("workspace.contacts.upload_contacts_modal_attributes_new")}
          />
        ) : null}
      </div>
    </>
  );
};
