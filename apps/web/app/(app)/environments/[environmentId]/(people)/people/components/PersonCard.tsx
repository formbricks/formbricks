import Link from "next/link";
import React from "react";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { TPerson } from "@formbricks/types/people";
import { PersonAvatar } from "@formbricks/ui/Avatars";

export const PersonCard = async ({ person }: { person: TPerson }) => {
  const attributes = await getAttributes(person.id);

  return (
    <Link
      href={`/environments/${person.environmentId}/people/${person.id}`}
      key={person.id}
      className="w-full">
      <div className="m-2 grid h-16 grid-cols-7 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100">
        <div className="col-span-3 flex items-center pl-6 text-sm">
          <div className="flex items-center">
            <div className="ph-no-capture h-10 w-10 flex-shrink-0">
              <PersonAvatar personId={person.id} />
            </div>
            <div className="ml-4">
              <div className="ph-no-capture font-medium text-slate-900">
                <span>{getPersonIdentifier({ id: person.id, userId: person.userId }, attributes)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-2 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">{person.userId}</div>
        </div>
        <div className="col-span-2 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">{attributes.email}</div>
        </div>
      </div>
    </Link>
  );
};
