import { getResponsesByContactId } from "@/lib/response/service";
import { getTranslate } from "@/lingodotdev/server";
import { getContactAttributesWithMetadata } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { formatAttributeValue } from "@/modules/ee/contacts/lib/format-attribute-value";
import {
  getContactAttributeDataTypeIcon,
  getContactAttributeDataTypeLabel,
} from "@/modules/ee/contacts/utils";
import { Badge } from "@/modules/ui/components/badge";
import { IdBadge } from "@/modules/ui/components/id-badge";

export const AttributesSection = async ({ contactId }: { contactId: string }) => {
  const t = await getTranslate();
  const [contact, attributesWithMetadata] = await Promise.all([
    getContact(contactId),
    getContactAttributesWithMetadata(contactId),
  ]);

  // Helper to get attribute value by key
  const getAttributeValue = (key: string): string | undefined => {
    return attributesWithMetadata.find((attr) => attr.key === key)?.value;
  };

  if (!contact) {
    throw new Error(t("environments.contacts.contact_not_found"));
  }

  const responses = await getResponsesByContactId(contactId);
  const numberOfResponses = responses?.length || 0;

  const email = getAttributeValue("email");
  const language = getAttributeValue("language");
  const userId = getAttributeValue("userId");

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-700">{t("common.attributes")}</h2>
      <div>
        <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className="flex items-center gap-1 text-slate-400">
            {getContactAttributeDataTypeIcon("string")}
            <Badge text={getContactAttributeDataTypeLabel("string", t)} type="gray" size="tiny" />
          </span>
          <span>email</span>
        </dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {email ? (
            <span>{email}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className="flex items-center gap-1 text-slate-400">
            {getContactAttributeDataTypeIcon("string")}
            <Badge text={getContactAttributeDataTypeLabel("string", t)} type="gray" size="tiny" />
          </span>
          <span>language</span>
        </dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {language ? (
            <span>{language}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className="flex items-center gap-1 text-slate-400">
            {getContactAttributeDataTypeIcon("string")}
            <Badge text={getContactAttributeDataTypeLabel("string", t)} type="gray" size="tiny" />
          </span>
          <span>userId</span>
        </dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {userId ? (
            <IdBadge id={userId} />
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className="flex items-center gap-1 text-slate-400">
            {getContactAttributeDataTypeIcon("string")}
            <Badge text={getContactAttributeDataTypeLabel("string", t)} type="gray" size="tiny" />
          </span>
          <span>contactId</span>
        </dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{contact.id}</dd>
      </div>

      {attributesWithMetadata
        .filter((attr) => attr.key !== "email" && attr.key !== "userId" && attr.key !== "language")
        .map((attr) => {
          return (
            <div key={attr.key}>
              <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="flex items-center gap-1 text-slate-400">
                  {getContactAttributeDataTypeIcon(attr.dataType)}
                  <Badge text={getContactAttributeDataTypeLabel(attr.dataType, t)} type="gray" size="tiny" />
                </span>
                <span>{attr.name || attr.key}</span>
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
