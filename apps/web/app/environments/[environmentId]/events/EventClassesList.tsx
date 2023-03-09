"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Button from "@/components/ui/Button";
import { useEventClasses } from "@/lib/eventClasses";
import { timeSinceConditionally } from "@/lib/time";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/20/solid";

const eventClasses = [
  {
    name: "Lindsay Walton",
    title: "Front-end Developer",
    department: "Optimization",
    email: "lindsay.walton@example.com",
    role: "Member",
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  },
  {
    name: "Lindsay Walton",
    title: "Front-end Developer",
    department: "Optimization",
    email: "lindsay.walton@example.com",
    role: "Member",
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  },
];

export default function EventClassesList({ environmentId }) {
  const { eventClasses, isLoadingEventClasses, isErrorEventClasses } = useEventClasses(environmentId);

  if (isLoadingEventClasses) {
    return <LoadingSpinner />;
  }

  if (isErrorEventClasses) {
    return <div>Error</div>;
  }
  return (
    <div className="">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto"></div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button variant="secondary">Add event</Button>
        </div>
      </div>
      <div className="mt-8 flow-root rounded border border-slate-300 bg-white p-2">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    # events
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Created
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {eventClasses.map((eventClass) => (
                  <tr key={eventClass.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                      <div className="flex items-center">
                        <div className="h-5 w-5 flex-shrink-0 text-slate-300">
                          {eventClass.type === "code" ? (
                            <CodeBracketIcon />
                          ) : eventClass.type === "noCode" ? (
                            <CursorArrowRaysIcon />
                          ) : eventClass.type === "automatic" ? (
                            <SparklesIcon />
                          ) : null}
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">{eventClass.name}</div>
                          <div className="text-gray-500">{eventClass.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="text-gray-900">{eventClass._count?.events}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="text-gray-900">{timeSinceConditionally(eventClass.createdAt)}</div>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                      {eventClass.type !== "automatic" && (
                        <a href="#" className="text-indigo-600 hover:text-indigo-900">
                          Edit<span className="sr-only">, {eventClass.name}</span>
                        </a>
                      )}
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
