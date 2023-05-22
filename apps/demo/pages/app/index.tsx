import LayoutApp from "@/components/LayoutApp";
import { classNames } from "@/lib/utils";
import { Bars3CenterLeftIcon, BellIcon, ScaleIcon } from "@heroicons/react/24/outline";
import {
  BanknotesIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import Image from "next/image";
import formbricks from "@formbricks/js";

const cards = [{ name: "Account balance", href: "#", icon: ScaleIcon, amount: "$30,659.45" }];
const transactions = [
  {
    id: 1,
    name: "Payment to Molly Sanders",
    href: "#",
    amount: "$20,000",
    currency: "USD",
    status: "success",
    date: "July 11, 2020",
    datetime: "2020-07-11",
  },
];
const statusStyles: any = {
  success: "bg-green-100 text-green-800",
  processing: "bg-yellow-100 text-yellow-800",
  failed: "bg-slate-100 text-slate-800",
};

export default function AppPage({}) {
  return (
    <LayoutApp>
      <div className="flex h-16 flex-shrink-0 border-b border-slate-200 bg-white lg:border-none">
        <button
          type="button"
          className="border-r border-slate-200 px-4 text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500 lg:hidden">
          <span className="sr-only">Open sidebar</span>
          <Bars3CenterLeftIcon className="h-6 w-6" aria-hidden="true" />
        </button>
        {/* Search bar */}
        <div className="flex flex-1 justify-between px-4 sm:px-6 lg:mx-auto lg:max-w-6xl lg:px-8">
          <div className="flex flex-1">
            <form className="flex w-full md:ml-0" action="#" method="GET">
              <label htmlFor="search-field" className="sr-only">
                Search
              </label>
              <div className="relative w-full text-slate-400 focus-within:text-slate-600">
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
                  aria-hidden="true">
                  <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  id="search-field"
                  name="search-field"
                  className="block h-full w-full border-transparent py-2 pl-8 pr-3 text-slate-900 placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-0 sm:text-sm"
                  placeholder="Search transactions"
                  type="search"
                />
              </div>
            </form>
          </div>
          <div className="ml-4 flex items-center md:ml-6">
            <button
              className="mr-2 flex max-w-xs items-center rounded-full bg-white text-sm  font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 lg:rounded-md lg:p-2 lg:hover:bg-slate-50"
              onClick={() => {
                formbricks.track("Cancel Subscription");
              }}>
              Feedback
            </button>
            <button className="mr-2 flex max-w-xs items-center rounded-full bg-white text-sm  font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 lg:rounded-md lg:p-2 lg:hover:bg-slate-50">
              No Code Feedback Btn Click
            </button>
            <button
              className="mr-2 flex max-w-xs items-center rounded-full bg-white text-sm  font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 lg:rounded-md lg:p-2 lg:hover:bg-slate-50"
              onClick={() => {
                formbricks.setEmail("test@web.com");
              }}>
              Set Email
            </button>
            <button
              className="mr-2 flex max-w-xs items-center rounded-full bg-white text-sm  font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 lg:rounded-md lg:p-2 lg:hover:bg-slate-50"
              onClick={() => {
                formbricks.setUserId("ASDASDAAAAAASSSSSSSASDASD");
              }}>
              Set Long UserID
            </button>
            <button
              className="mr-2 flex max-w-xs items-center rounded-full bg-white text-sm  font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 lg:rounded-md lg:p-2 lg:hover:bg-slate-50"
              onClick={() => {
                formbricks.setAttribute("Plan", "Free");
              }}>
              Set attribute &quot;Free&quot;
            </button>
            <button
              className="mr-2 flex max-w-xs items-center rounded-full bg-white text-sm  font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 lg:rounded-md lg:p-2 lg:hover:bg-slate-50"
              onClick={() => {
                formbricks.setAttribute("Plan", "Paid");
              }}>
              Set attribute &quot;Paid&quot;
            </button>

            {/* Profile dropdown */}
            <div className="relative ml-3">
              <div>
                <button className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 lg:rounded-md lg:p-2 lg:hover:bg-slate-50">
                  <Image
                    className="h-8 w-8 rounded-full"
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    width={32}
                    height={32}
                    alt=""
                  />
                  <span className="ml-3 hidden text-sm font-medium text-slate-700 lg:block">
                    <span className="sr-only">Open user menu for </span>Emilia Birch
                  </span>
                  <ChevronDownIcon
                    className="ml-1 hidden h-5 w-5 flex-shrink-0 text-slate-400 lg:block"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <main className="flex-1 pb-8">
        {/* Page header */}
        <div className="bg-white shadow">
          <div className="px-4 sm:px-6 lg:mx-auto lg:max-w-6xl lg:px-8">
            <div className="py-6 md:flex md:items-center md:justify-between lg:border-t lg:border-slate-200">
              <div className="min-w-0 flex-1">
                {/* Profile */}
                <div className="flex items-center">
                  <Image
                    className="hidden h-16 w-16 rounded-full sm:block"
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.6&w=256&h=256&q=80"
                    alt=""
                    width={32}
                    height={32}
                  />
                  <div>
                    <div className="flex items-center">
                      <Image
                        className="h-16 w-16 rounded-full sm:hidden"
                        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.6&w=256&h=256&q=80"
                        alt=""
                        width={32}
                        height={32}
                      />
                      <h1 className="ml-3 text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:leading-9">
                        Good morning, Emilia Birch
                      </h1>
                    </div>
                    <dl className="mt-6 flex flex-col sm:ml-3 sm:mt-1 sm:flex-row sm:flex-wrap">
                      <dt className="sr-only">Company</dt>
                      <dd className="flex items-center text-sm font-medium capitalize text-slate-500 sm:mr-6">
                        <BuildingOfficeIcon
                          className="mr-1.5 h-5 w-5 flex-shrink-0 text-slate-400"
                          aria-hidden="true"
                        />
                        Duke street studio
                      </dd>
                      <dt className="sr-only">Account status</dt>
                      <dd className="mt-3 flex items-center text-sm font-medium capitalize text-slate-500 sm:mr-6 sm:mt-0">
                        <CheckCircleIcon
                          className="mr-1.5 h-5 w-5 flex-shrink-0 text-green-400"
                          aria-hidden="true"
                        />
                        Verified account
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex space-x-3 md:ml-4 md:mt-0">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2">
                  Add money
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-transparent bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2">
                  Send money
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg font-medium leading-6 text-slate-900">Overview</h2>
            <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Card */}
              {cards.map((card) => (
                <div key={card.name} className="overflow-hidden rounded-lg bg-white shadow">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <card.icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="truncate text-sm font-medium text-slate-500">{card.name}</dt>
                          <dd>
                            <div className="text-lg font-medium text-slate-900">{card.amount}</div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-5 py-3">
                    <div className="text-sm">
                      <a href={card.href} className="font-medium text-cyan-700 hover:text-cyan-900">
                        View all
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <h2 className="mx-auto mt-8 max-w-6xl px-4 text-lg font-medium leading-6 text-slate-900 sm:px-6 lg:px-8">
            Recent activity
          </h2>

          {/* Activity list (smallest breakpoint only) */}
          <div className="shadow sm:hidden">
            <ul role="list" className="mt-2 divide-y divide-slate-200 overflow-hidden shadow sm:hidden">
              {transactions.map((transaction) => (
                <li key={transaction.id}>
                  <a href={transaction.href} className="block bg-white px-4 py-4 hover:bg-slate-50">
                    <span className="flex items-center space-x-4">
                      <span className="flex flex-1 space-x-2 truncate">
                        <BanknotesIcon className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="flex flex-col truncate text-sm text-slate-500">
                          <span className="truncate">{transaction.name}</span>
                          <span>
                            <span className="font-medium text-slate-900">{transaction.amount}</span>{" "}
                            {transaction.currency}
                          </span>
                          <time dateTime={transaction.datetime}>{transaction.date}</time>
                        </span>
                      </span>
                      <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <nav
              className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3"
              aria-label="Pagination">
              <div className="flex flex-1 justify-between">
                <a
                  href="#"
                  className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-500">
                  Previous
                </a>
                <a
                  href="#"
                  className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-500">
                  Next
                </a>
              </div>
            </nav>
          </div>

          {/* Activity table (small breakpoint and up) */}
          <div className="hidden sm:block">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="mt-2 flex flex-col">
                <div className="min-w-full overflow-hidden overflow-x-auto align-middle shadow sm:rounded-lg">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr>
                        <th
                          className="bg-slate-50 px-6 py-3 text-left text-sm font-semibold text-slate-900"
                          scope="col">
                          Transaction
                        </th>
                        <th
                          className="bg-slate-50 px-6 py-3 text-right text-sm font-semibold text-slate-900"
                          scope="col">
                          Amount
                        </th>
                        <th
                          className="hidden bg-slate-50 px-6 py-3 text-left text-sm font-semibold text-slate-900 md:block"
                          scope="col">
                          Status
                        </th>
                        <th
                          className="bg-slate-50 px-6 py-3 text-right text-sm font-semibold text-slate-900"
                          scope="col">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="bg-white">
                          <td className="w-full max-w-0 whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                            <div className="flex">
                              <a
                                href={transaction.href}
                                className="group inline-flex space-x-2 truncate text-sm">
                                <BanknotesIcon
                                  className="h-5 w-5 flex-shrink-0 text-slate-400 group-hover:text-slate-500"
                                  aria-hidden="true"
                                />
                                <p className="truncate text-slate-500 group-hover:text-slate-900">
                                  {transaction.name}
                                </p>
                              </a>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-500">
                            <span className="font-medium text-slate-900">{transaction.amount}</span>
                            {transaction.currency}
                          </td>
                          <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-slate-500 md:block">
                            <span
                              className={classNames(
                                statusStyles[transaction.status],
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                              )}>
                              {transaction.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-500">
                            <time dateTime={transaction.datetime}>{transaction.date}</time>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  <nav
                    className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6"
                    aria-label="Pagination">
                    <div className="hidden sm:block">
                      <p className="text-sm text-slate-700">
                        Showing <span className="font-medium">1</span> to{" "}
                        <span className="font-medium">10</span> of <span className="font-medium">20</span>{" "}
                        results
                      </p>
                    </div>
                    <div className="flex flex-1 justify-between sm:justify-end">
                      <a
                        href="#"
                        id="test-css"
                        className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        CSS ID Test
                      </a>
                      <a
                        href="#"
                        className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Next
                      </a>
                    </div>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </LayoutApp>
  );
}
