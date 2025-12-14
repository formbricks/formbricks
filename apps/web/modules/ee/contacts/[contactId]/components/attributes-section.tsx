import { format } from "date-fns";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getResponsesByContactId } from "@/lib/response/service";
import { getTranslate } from "@/lingodotdev/server";
import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { IdBadge } from "@/modules/ui/components/id-badge";

interface AttributesSectionProps {
  contactId: string;
  attributeKeys: TContactAttributeKey[];
}

export const AttributesSection = async ({ contactId, attributeKeys }: AttributesSectionProps) => {
  const t = await getTranslate();
  const [contact, attributes] = await Promise.all([getContact(contactId), getContactAttributes(contactId)]);

  if (!contact) {
    throw new Error(t("environments.contacts.contact_not_found"));
  }

  const responses = await getResponsesByContactId(contactId);
  const numberOfResponses = responses?.length || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-700">{t("common.attributes")}</h2>
      <div>
        <dt className="text-sm font-medium text-slate-500">email</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.email ? (
            <span>{attributes.email as string}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">language</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.language ? (
            <span>{attributes.language as string}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">userId</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.userId ? (
            <IdBadge id={attributes.userId as string} />
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">contactId</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{contact.id}</dd>
      </div>

      {Object.entries(attributes)
        .filter(([key, _]) => key !== "email" && key !== "userId" && key !== "language")
        .map(([key, attributeData]) => {
          const attributeKey = attributeKeys.find((ak) => ak.key === key);
          let displayValue = attributeData;

          if (attributeKey?.dataType === "date" && displayValue) {
            try {
              // assume attributeData is string ISO date or Date object
              displayValue = format(new Date(displayValue as string | number | Date), "do 'of' MMMM, yyyy");
            } catch (e) {
              // fallback
            }
          }

          if (displayValue instanceof Date) {
            displayValue = displayValue.toLocaleDateString();
          }

          return (
            <div key={key}>
              <dt className="text-sm font-medium text-slate-500">{attributeKey?.name ?? key}</dt>
              <dd className="mt-1 text-sm text-slate-900">{displayValue}</dd>
            </div>
          );
        })}
      <hr />

      <div>
        <dt className="text-sm font-medium text-slate-500">{t("common.responses")}</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfResponses}</dd>
      </div>
    </div>
  );
};
