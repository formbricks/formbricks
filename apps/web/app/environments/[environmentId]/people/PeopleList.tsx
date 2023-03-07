"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { usePeople } from "@/lib/people";
import AvatarPlaceholder from "@/images/avatar-placeholder.png";
import Image from "next/image";

export default function PeopleList({ environmentId }: { environmentId: string }) {
  const { people, isLoadingPeople, isErrorPeople } = usePeople(environmentId);

  if (isLoadingPeople) {
    return <LoadingSpinner />;
  }
  if (isErrorPeople) {
    return <div>Error</div>;
  }

  return (
    <div>
      <div className="mt-8 flow-root rounded border border-slate-300 bg-white p-2">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                    User
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    User ID
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {people.map((person) => (
                  <tr key={person.email}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <Image src={AvatarPlaceholder} alt="Avatar Placeholder" className="rounded-full" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">{person.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="text-gray-900">{person.userId}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="text-gray-900">{person.email}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
