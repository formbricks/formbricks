import { UploadContactsAttributeCombobox } from "@/modules/ee/contacts/components/upload-contacts-attribute-combobox";
import { createId } from "@paralleldrive/cuid2";
import { useEffect, useMemo, useState } from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";

interface UploadContactsAttributesProps {
  attributeMap: Record<string, string>;
  setAttributeMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  contactAttributeKeys: TContactAttributeKey[];
  csvColumn: string;
}

export const UploadContactsAttributes = ({
  attributeMap,
  contactAttributeKeys,
  setAttributeMap,
  csvColumn,
}: UploadContactsAttributesProps) => {
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
    return keys.reduce((acc, tag) => {
      acc[tag.value] = tag.label;
      return acc;
    }, {});
  }, [keys]);

  // State for the currently selected tag
  const [currentKey, setCurrentKey] = useState<{ label: string; value: string } | null>(() => {
    const mappedValue = attributeMap[csvColumn];
    if (!mappedValue) return null;

    // Find the matching tag to get its label
    const matchingTag = keys.find((tag) => tag.value === mappedValue);
    if (matchingTag) {
      return matchingTag;
    }

    // If no matching tag found but we have a mapped value, create a tag for it
    return {
      label: attributeKeyMap[mappedValue] || mappedValue,
      value: mappedValue,
    };
  });

  // Update currentTag when attributeMap changes
  useEffect(() => {
    const mappedValue = attributeMap[csvColumn];
    if (!mappedValue) {
      setCurrentKey(null);
      return;
    }

    // Find the matching tag to get its label
    const matchingTag = keys.find((tag) => tag.value === mappedValue);
    if (matchingTag) {
      setCurrentKey(matchingTag);
    } else {
      console.log({
        label: attributeKeyMap[mappedValue] || mappedValue,
        value: mappedValue,
      });
      // If no matching tag found, create one with the mapped value
      setCurrentKey({
        label: attributeKeyMap[mappedValue] || mappedValue,
        value: mappedValue,
      });
    }
  }, [attributeMap, csvColumn, attributeKeyMap, keys]);

  const handleAddAttribute = (value: string) => {
    // Find the tag that matches the selected value
    const selectedTag = keys.find((tag) => tag.value === value);
    if (!selectedTag) return;

    // Update the currentTag
    setCurrentKey(selectedTag);

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

    // Set the new tag as current
    setCurrentKey(newTag);

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
    <div className="flex w-full items-center justify-start gap-4">
      <span className="w-20 font-medium text-slate-700">{csvColumn}</span>
      <h4 className="text-sm font-medium text-slate-500">should be mapped to</h4>
      <div className="flex-1">
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
      </div>
    </div>
  );
};
