import { getTranslations } from "next-intl/server";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { getPerson } from "@formbricks/lib/person/service";
import { getResponsesByPersonId } from "@formbricks/lib/response/service";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";

export const AttributesSection = async ({ personId }: { personId: string }) => {
  const t = await getTranslations();
  const [person, attributes] = await Promise.all([getPerson(personId), getAttributes(personId)]);
  if (!person) {
    throw new Error(t("environments.people.person_not_found"));
  }

  const responses = await getResponsesByPersonId(personId);

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
            <span className="text-slate-300">{t("environments.people.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">{t("common.language")}</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {attributes.language ? (
            <span>{attributes.language}</span>
          ) : (
            <span className="text-slate-300">{t("environments.people.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">{t("common.user_id")}</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {person.userId ? (
            <span>{person.userId}</span>
          ) : (
            <span className="text-slate-300">{t("environments.people.not_provided")}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">{t("environments.people.formbricks_id")}</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{person.id}</dd>
      </div>

      {Object.entries(attributes)
        .filter(([key, _]) => key !== "email" && key !== "userId" && key !== "language")
        .map(([key, value]) => (
          <div key={key}>
            <dt className="text-sm font-medium text-slate-500">{capitalizeFirstLetter(key.toString())}</dt>
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
