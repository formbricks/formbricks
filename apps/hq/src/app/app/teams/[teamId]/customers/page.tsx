"use client";

import LoadingSpinner from "@/app/LoadingSpinner";
import EmptyPageFiller from "@/components/EmptyPageFiller";
import { useCustomers } from "@/lib/customers";
import { useTeam } from "@/lib/teams";
import { convertDateTimeString } from "@/lib/utils";
import { UsersIcon } from "@heroicons/react/24/outline";

export default function FormsPage({ params }) {
  const { customers, isLoadingCustomers, isErrorCustomers } = useCustomers(params.teamId);
  const { team, isLoadingTeam, isErrorTeam } = useTeam(params.teamId);

  if (isLoadingCustomers || isLoadingTeam) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorCustomers || isErrorTeam) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          Customers
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {team.name}
          </span>
        </h1>
      </header>
      {customers.length === 0 ? (
        <EmptyPageFiller
          alertText={"We don't know your customers yet"}
          hintText={
            "Make a first submission and reference your customer. We will collect all submission from them accross all of your forms and display them here."
          }>
          <UsersIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
        </EmptyPageFiller>
      ) : (
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Id
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        created At
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        # submissions
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">View</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {customers.map((customer, customerIdx) => (
                      <tr key={customer.email} className={customerIdx % 2 === 0 ? undefined : "bg-gray-50"}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {customer.id}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {convertDateTimeString(customer.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {customer._count?.submissions}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <a href="#" className="text-brand-dark hover:text-brand-light">
                            View<span className="sr-only">, {customer.name}</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
