"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAttributeClasses } from "@/lib/attributeClasses";
import { TagIcon } from "@heroicons/react/20/solid";
import Link from "next/link";

export default function AttributeClassesList({ environmentId }: { environmentId: string }) {
  const { attributeClasses, isLoadingAttributeClasses, isErrorAttributeClasses } =
    useAttributeClasses(environmentId);

  if (isLoadingAttributeClasses) {
    return <LoadingSpinner />;
  }
  if (isErrorAttributeClasses) {
    return <div>Error</div>;
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="grid h-12 grid-cols-12 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-gray-900">
        <div className="col-span-4 pl-6 ">Name</div>
        <div className="col-span-4 pl-6 ">People</div>
      </div>
      <div className="grid-cols-7">
        {attributeClasses.map((attributeClass) => (
          <Link href="/" className="w-full">
            <div
              key={attributeClass.id}
              className="m-2 grid h-16  grid-cols-7 content-center rounded-lg hover:bg-slate-100">
              <div className="col-span-4 flex items-center pl-6 text-sm">
                <div className="flex items-center">
                  <div className="h-10 w-10 flex-shrink-0">
                    <TagIcon className="h-8 w-8 flex-shrink-0 text-slate-300" />
                  </div>
                  <div className="ml-4">
                    <div className="font-medium text-gray-900">{attributeClass.name}</div>
                  </div>
                </div>
              </div>
              <div className="my-auto whitespace-nowrap text-center text-sm text-gray-500">
                <div className="text-gray-900">{attributeClass.userId}</div>
              </div>
              <div className="my-auto whitespace-nowrap text-center text-sm text-gray-500">
                <div className="text-gray-900">{attributeClass.email}</div>
              </div>
              <div className="my-auto whitespace-nowrap text-center text-sm text-gray-500">
                <div className="text-gray-900">{attributeClass._count?.sessions}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
