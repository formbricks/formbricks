export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";

import { capitalizeFirstLetter } from "@/lib/utils";
import { getPerson } from "@formbricks/lib/person/service";
import { getResponsesByPersonId } from "@formbricks/lib/response/service";
import { getSessionCount } from "@formbricks/lib/session/service";

export default async function AttributesSection({ personId }: { personId: string }) {
  const person = await getPerson(personId);
  if (!person) {
    throw new Error("No such person found");
  }
  const numberOfSessions = await getSessionCount(personId);
  const responses = await getResponsesByPersonId(personId);

  const numberOfResponses = responses?.length || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-700">Attributes</h2>
      <div>
        <dt className="text-sm font-medium text-slate-500">Email</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {person.attributes.email ? (
            <span>{person.attributes.email}</span>
          ) : (
            <span className="text-slate-300">Not provided</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">User Id</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {person.attributes.userId ? (
            <span>{person.attributes.userId}</span>
          ) : (
            <span className="text-slate-300">Not provided</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">Formbricks Id (internal)</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{person.id}</dd>
      </div>

      {Object.entries(person.attributes)
        .filter(([key, _]) => key !== "email" && key !== "userId")
        .map(([key, value]) => (
          <div key={key}>
            <dt className="text-sm font-medium text-slate-500">{capitalizeFirstLetter(key.toString())}</dt>
            <dd className="mt-1 text-sm text-slate-900">{value}</dd>
          </div>
        ))}
      <hr />

      <div>
        <dt className="text-sm font-medium text-slate-500">Sessions</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfSessions}</dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">Responses</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfResponses}</dd>
      </div>
    </div>
  );
}
