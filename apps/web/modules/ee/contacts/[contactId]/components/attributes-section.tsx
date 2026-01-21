import { getResponsesByContactId } from "@/lib/response/service";
import { getTranslate } from "@/lingodotdev/server";
import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { IdBadge } from "@/modules/ui/components/id-badge";

const DEFAULT_ATTRIBUTE_KEYS = ["email", "language", "userId", "firstName", "lastName"] as const;

interface AttributeRowProps {
  label: string;
  value: string | undefined;
  notProvidedText: string;
  isIdBadge?: boolean;
}

const AttributeRow = ({ label, value, notProvidedText, isIdBadge = false }: AttributeRowProps) => {
  const renderValue = () => {
    if (!value) {
      return <span className="text-slate-300">{notProvidedText}</span>;
    }
    if (isIdBadge) {
      return <IdBadge id={value} />;
    }
    return <span>{value}</span>;
  };

  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="ph-no-capture mt-1 text-sm text-slate-900">{renderValue()}</dd>
    </div>
  );
};

export const AttributesSection = async ({ contactId }: { contactId: string }) => {
  const t = await getTranslate();
  const [contact, attributes] = await Promise.all([getContact(contactId), getContactAttributes(contactId)]);

  if (!contact) {
    throw new Error(t("environments.contacts.contact_not_found"));
  }

  const responses = await getResponsesByContactId(contactId);
  const numberOfResponses = responses?.length || 0;
  const notProvidedText = t("environments.contacts.not_provided");

  const customAttributes = Object.entries(attributes).filter(
    ([key]) => !DEFAULT_ATTRIBUTE_KEYS.includes(key as (typeof DEFAULT_ATTRIBUTE_KEYS)[number])
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-700">{t("common.attributes")}</h2>

      <AttributeRow label="email" value={attributes.email} notProvidedText={notProvidedText} />
      <AttributeRow label="language" value={attributes.language} notProvidedText={notProvidedText} />
      <AttributeRow label="userId" value={attributes.userId} notProvidedText={notProvidedText} isIdBadge />
      <AttributeRow label="firstName" value={attributes.firstName} notProvidedText={notProvidedText} />
      <AttributeRow label="lastName" value={attributes.lastName} notProvidedText={notProvidedText} />

      <div>
        <dt className="text-sm font-medium text-slate-500">contactId</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{contact.id}</dd>
      </div>

      {customAttributes.map(([key, value]) => (
        <div key={key}>
          <dt className="text-sm font-medium text-slate-500">{key}</dt>
          <dd className="mt-1 text-sm text-slate-900">{value}</dd>
        </div>
      ))}

      <hr />

      <div>
        <dt className="text-sm font-medium text-slate-500">{t("common.responses")}</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfResponses}</dd>
      </div>
    </div>
  );
};
