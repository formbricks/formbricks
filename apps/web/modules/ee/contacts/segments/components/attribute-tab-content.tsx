import { useTranslate } from "@tolgee/react";
import { FingerprintIcon, TagIcon } from "lucide-react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
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
  }) => void;
}

// Helper component to render a FilterButton with common handlers
function FilterButtonWithHandler({
  // NOSONAR // read-only is not used in the project
  dataTestId,
  icon,
  label,
  type,
  onAddFilter,
  setOpen,
  handleAddFilter,
  contactAttributeKey,
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
  }) => void;
  contactAttributeKey?: string;
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
          ...(type === "attribute" ? { contactAttributeKey } : {}),
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleAddFilter({
            type,
            onAddFilter,
            setOpen,
            ...(type === "attribute" ? { contactAttributeKey } : {}),
          });
        }
      }}
    />
  );
}

function AttributeTabContent({
  // NOSONAR // read-only is not used in the project
  contactAttributeKeys,
  onAddFilter,
  setOpen,
  handleAddFilter,
}: AttributeTabContentProps) {
  const { t } = useTranslate();

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
      {contactAttributeKeys.map((attributeKey) => (
        <FilterButtonWithHandler
          key={attributeKey.id}
          dataTestId={`filter-btn-attribute-${attributeKey.key}`}
          icon={<TagIcon className="h-4 w-4" />}
          label={attributeKey.name ?? attributeKey.key}
          type="attribute"
          onAddFilter={onAddFilter}
          setOpen={setOpen}
          handleAddFilter={handleAddFilter}
          contactAttributeKey={attributeKey.key}
        />
      ))}
    </div>
  );
}

export default AttributeTabContent;
