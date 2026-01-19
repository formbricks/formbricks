import { getResponsesByContactId } from "@/lib/response/service";
import { getTranslate } from "@/lingodotdev/server";
import {
  getContactAttributes,
  getContactAttributesWithMetadata,
} from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { formatAttributeValue } from "@/modules/ee/contacts/lib/format-attribute-value";
import { Badge } from "@/modules/ui/components/badge";
import { IdBadge } from "@/modules/ui/components/id-badge";

export const AttributesSection = async ({ contactId }: { contactId: string }) => {
  const t = await getTranslate();
  const [contact, attributes, attributesWithMetadata] = await Promise.all([
    getContact(contactId),
    getContactAttributes(contactId),
    getContactAttributesWithMetadata(contactId),
  ]);

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
            <span>{attributes.email}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">language</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.language ? (
            <span>{attributes.language}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">userId</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.userId ? (
            <IdBadge id={attributes.userId} />
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">contactId</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{contact.id}</dd>
      </div>

      {attributesWithMetadata
        .filter((attr) => attr.key !== "email" && attr.key !== "userId" && attr.key !== "language")
        .map((attr) => {
          return (
            <div key={attr.key}>
              <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span>{attr.name || attr.key}</span>
                <Badge text={attr.dataType} type="gray" size="tiny" />
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatAttributeValue(attr.value, attr.dataType)}
              </dd>
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
