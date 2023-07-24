import { capitalizeFirstLetter } from "@/lib/utils";
import { TPersonDetailedAttribute, TPersonWithDetailedAttributes } from "@formbricks/types/v1/people";

export default function AttributesSection({
  email,
  userId,
  otherAttributes,
  personWithAttributes,
  numberOfSessions,
  numberOfResponses,
}: {
  email: string | undefined;
  userId: string | undefined;
  otherAttributes: TPersonDetailedAttribute[];
  personWithAttributes: TPersonWithDetailedAttributes;
  numberOfSessions: number;
  numberOfResponses: number;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-700">Attributes</h2>
      <div>
        <dt className="text-sm font-medium text-slate-500">Email</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {email ? <span>{email}</span> : <span className="text-slate-300">Not provided</span>}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">User Id</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">
          {userId ? <span>{userId}</span> : <span className="text-slate-300">Not provided</span>}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">Formbricks Id (internal)</dt>
        <dd className="ph-no-capture mt-1 text-sm text-slate-900">{personWithAttributes?.id}</dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-slate-500">Sessions</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfSessions}</dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">Responses</dt>
        <dd className="mt-1 text-sm text-slate-900">{numberOfResponses}</dd>
      </div>
      {otherAttributes.map((attribute) => (
        <div key={attribute.name}>
          <dt className="text-sm font-medium text-slate-500">{capitalizeFirstLetter(attribute.name)}</dt>
          <dd className="mt-1 text-sm text-slate-900">{attribute.value}</dd>
        </div>
      ))}
    </div>
  );
}
