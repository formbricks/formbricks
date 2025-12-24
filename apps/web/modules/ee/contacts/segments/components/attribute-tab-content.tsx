import { Calendar1Icon, FingerprintIcon, HashIcon, TagIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TContactAttributeDataType, TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type { TBaseFilter } from "@formbricks/types/segment";
import FilterButton from "./filter-button";

interface AttributeTabContentProps {
  contactAttributeKeys: TContactAttributeKey[];
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
  handleAddFilter: (args: {
    type: "attribute" | "person";
    onAddFilter: (filter: TBaseFilter) => void;
    setOpen: (open: boolean) => void;
    contactAttributeKey?: string;
    attributeDataType?: TContactAttributeDataType;
  }) => void;
}

// Helper component to render a FilterButton with common handlers
function FilterButtonWithHandler({
  dataTestId,
  icon,
  label,
  type,
  onAddFilter,
  setOpen,
  handleAddFilter,
  contactAttributeKey,
  attributeDataType,
}: {
  dataTestId: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  type: "attribute" | "person";
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
  handleAddFilter: (args: {
    type: "attribute" | "person";
    onAddFilter: (filter: TBaseFilter) => void;
    setOpen: (open: boolean) => void;
    contactAttributeKey?: string;
    attributeDataType?: TContactAttributeDataType;
  }) => void;
  contactAttributeKey?: string;
  attributeDataType?: TContactAttributeDataType;
}) {
  return (
    <FilterButton
      data-testid={dataTestId}
      icon={icon}
      label={label}
      onClick={() => {
        handleAddFilter({
          type,
          onAddFilter,
          setOpen,
          ...(type === "attribute" ? { contactAttributeKey, attributeDataType } : {}),
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleAddFilter({
            type,
            onAddFilter,
            setOpen,
            ...(type === "attribute" ? { contactAttributeKey, attributeDataType } : {}),
          });
        }
      }}
    />
  );
}

function AttributeTabContent({
  contactAttributeKeys,
  onAddFilter,
  setOpen,
  handleAddFilter,
}: AttributeTabContentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-medium">{t("common.person")}</h2>
        <div>
          <FilterButtonWithHandler
            dataTestId="filter-btn-person-userId"
            icon={<FingerprintIcon className="h-4 w-4" />}
            label={t("common.user_id")}
            type="person"
            onAddFilter={onAddFilter}
            setOpen={setOpen}
            handleAddFilter={handleAddFilter}
          />
        </div>
      </div>

      <hr className="my-2" />

      <div>
        <h2 className="text-base font-medium">{t("common.attributes")}</h2>
      </div>
      {contactAttributeKeys.length === 0 && (
        <div className="flex w-full items-center justify-center gap-4 rounded-lg px-2 py-1 text-sm">
          <p>{t("environments.segments.no_attributes_yet")}</p>
        </div>
      )}
      {contactAttributeKeys.map((attributeKey) => {
        const icon =
          attributeKey.dataType === "date" ? (
            <Calendar1Icon className="h-4 w-4" />
          ) : attributeKey.dataType === "number" ? (
            <HashIcon className="h-4 w-4" />
          ) : (
            <TagIcon className="h-4 w-4" />
          );

        return (
          <FilterButtonWithHandler
            key={attributeKey.id}
            dataTestId={`filter-btn-attribute-${attributeKey.key}`}
            icon={icon}
            label={attributeKey.name ?? attributeKey.key}
            type="attribute"
            onAddFilter={onAddFilter}
            setOpen={setOpen}
            handleAddFilter={handleAddFilter}
            contactAttributeKey={attributeKey.key}
            attributeDataType={attributeKey.dataType}
          />
        );
      })}
    </div>
  );
}

export default AttributeTabContent;
