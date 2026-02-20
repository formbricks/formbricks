import { getDisplaysByContactId } from "@/lib/display/service";
import { getResponsesByContactId } from "@/lib/response/service";
import { getTranslate } from "@/lingodotdev/server";
import { getContactAttributesWithKeyInfo } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { formatAttributeValue } from "@/modules/ee/contacts/lib/format-attribute-value";
import { getContactAttributeDataTypeIcon } from "@/modules/ee/contacts/utils";
import { IdBadge } from "@/modules/ui/components/id-badge";

export const AttributesSection = async ({ contactId }: { contactId: string }) => {
  const t = await getTranslate();
  const [contact, attributesWithKeyInfo] = await Promise.all([
    getContact(contactId),
    getContactAttributesWithKeyInfo(contactId),
  ]);

  if (!contact) {
    throw new Error(t("environments.contacts.contact_not_found"));
  }

  const [responses, displays] = await Promise.all([
    getResponsesByContactId(contactId),
    getDisplaysByContactId(contactId),
  ]);
  const numberOfResponses = responses?.length || 0;
  const numberOfDisplays = displays?.length || 0;

  const systemAttributes = attributesWithKeyInfo
    .filter((attr) => attr.type === "default")
    .sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key));

  const customAttributes = attributesWithKeyInfo
    .filter((attr) => attr.type === "custom")
    .sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key));

  const renderAttributeValue = (attr: (typeof attributesWithKeyInfo)[number]) => {
    if (!attr.value) {
      return <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>;
    }

    // Special handling for userId to show IdBadge
    if (attr.key === "userId") {
      return <IdBadge id={attr.value} />;
    }

    return formatAttributeValue(attr.value, attr.dataType);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-700">{t("environments.contacts.system_attributes")}</h2>

      {systemAttributes.map((attr) => (
        <div key={attr.key}>
          <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <span className="text-slate-400">{getContactAttributeDataTypeIcon(attr.dataType)}</span>
            <span>{attr.name || attr.key}</span>
          </dt>
          <dd className="ph-no-capture mt-1 text-sm text-slate-900">{renderAttributeValue(attr)}</dd>
        </div>
      ))}

      <div>
        <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className="text-slate-400">{getContactAttributeDataTypeIcon("string")}</span>
          <span>contactId</span>
        </dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{contact.id}</dd>
      </div>

      {customAttributes.length > 0 && (
        <>
          <hr />
          <h2 className="text-lg font-bold text-slate-700">{t("environments.contacts.custom_attributes")}</h2>
          {customAttributes.map((attr) => (
            <div key={attr.key}>
              <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="text-slate-400">{getContactAttributeDataTypeIcon(attr.dataType)}</span>
                <span>{attr.name || attr.key}</span>
              </dt>
              <dd className="mt-1 text-sm text-slate-900">{renderAttributeValue(attr)}</dd>
            </div>
          ))}
        </>
      )}

      <hr />

      <div>
        <dt className="text-sm font-medium text-slate-500">{t("common.responses")}</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfResponses}</dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-slate-500">{t("environments.contacts.displays")}</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfDisplays}</dd>
      </div>
    </div>
  );
};
