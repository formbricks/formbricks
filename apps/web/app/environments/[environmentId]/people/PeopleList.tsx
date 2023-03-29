"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { PersonAvatar } from "@formbricks/ui";
import { ErrorComponent } from "@formbricks/ui";
import { usePeople } from "@/lib/people/people";
import Link from "next/link";

export default function PeopleList({ environmentId }: { environmentId: string }) {
  const { people, isLoadingPeople, isErrorPeople } = usePeople(environmentId);

  if (isLoadingPeople) {
    return <LoadingSpinner />;
  }
  if (isErrorPeople) {
    return <ErrorComponent />;
  }

  const getAttributeValue = (person, attributeName) => {
    return person.attributes.find((a) => a.attributeClass.name === attributeName)?.value;
  };

  return (
    <>
      {people.length === 0 ? (
        <EmptySpaceFiller type="table" environmentId={environmentId} />
      ) : (
        <div className="rounded-lg border border-slate-200">
          <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
            <div className="col-span-4 pl-6 ">User</div>
            <div className="text-center">User ID</div>
            <div className="text-center">Email</div>
            <div className="text-center">Sessions</div>
          </div>
          <div className="grid-cols-7">
            {people.map((person) => (
              <Link
                href={`/environments/${environmentId}/people/${person.id}`}
                key={person.id}
                className="w-full">
                <div className="m-2 grid h-16  grid-cols-7 content-center rounded-lg hover:bg-slate-100">
                  <div className="col-span-4 flex items-center pl-6 text-sm">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <PersonAvatar personId={person.id} />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-slate-900">{person.id}</div>
                      </div>
                    </div>
                  </div>
                  <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                    <div className="text-slate-900">{getAttributeValue(person, "userId")}</div>
                  </div>
                  <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                    <div className="text-slate-900">{getAttributeValue(person, "email")}</div>
                  </div>
                  <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                    <div className="text-slate-900">{person._count?.sessions}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
