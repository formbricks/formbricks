import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { getTranslate } from "@/tolgee/server";
import { getResponsesByContactId } from "@formbricks/lib/response/service";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";

export const AttributesSection = async ({ contactId }: { contactId: string }) => {
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
        <dt className="text-sm font-medium text-slate-500">{t("common.email")}</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.email ? (
            <span>{attributes.email}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">{t("common.language")}</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.language ? (
            <span>{attributes.language}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">{t("common.user_id")}</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.userId ? (
            <span>{attributes.userId}</span>
          ) : (
            <span className="text-slate-300">{t("environments.contacts.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">ID</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{contact.id}</dd>
      </div>

      {Object.entries(attributes)
        .filter(([key, _]) => key !== "email" && key !== "userId" && key !== "language")
        .map(([key, attributeData]) => {
          return (
            <div key={key}>
              <dt className="text-sm font-medium text-slate-500">{capitalizeFirstLetter(key.toString())}</dt>
              <dd className="mt-1 text-sm text-slate-900">{attributeData}</dd>
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
