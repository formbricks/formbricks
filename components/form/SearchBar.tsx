import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { AdjustmentsVerticalIcon } from "@heroicons/react/24/solid";
import { MdSortByAlpha, MdToday } from "react-icons/md";

function SearchBar({
  className,
  queryValue,
  setQueryValue,
  formData,
  setFormData,
}) {
  const filterByName = (data) => {
    setFormData(
      data.sort(function (a, b) {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      })
    );

    return formData;
  };

  return (
    <div className={`${className}`}>
      <input
        type="text"
        name="name"
        className="block w-full p-3 border-none rounded bg-ui-gray-light focus:ring-2 focus:ring-red sm:text-sm placeholder:font-extralight placeholder:text-ui-gray-medium"
        placeholder="e.g. Registration for the Kadea  Academy"
        value={queryValue}
        onChange={(e) => setQueryValue(e.target.value)}
        autoFocus
      />
      <Menu as="div" className="relative inline-block text-left">
        <div>
          <Menu.Button className="inline-flex w-full justify-center rounded bg-snoopfade bg-opacity-50 px-4 py-3 text-sm font-medium text-white hover:bg-opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
            <AdjustmentsVerticalIcon className="w-5 mr-2" />
            options
            <ChevronDownIcon
              className="ml-2 -mr-1 h-5 w-5 text-white-200 hover:text-white-100"
              aria-hidden="true"
            />
          </Menu.Button>
        </div>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="z-40 absolute left-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="px-1 py-1 ">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? "bg-red-500 text-white" : "text-gray-900"
                    } group flex w-full items-center rounded px-2 py-2 text-sm`}
                    onClick={() => filterByName(formData)}
                  >
                    <MdSortByAlpha
                      className="mr-2 h-5 w-5"
                      aria-hidden="true"
                    />
                    Sort by name
                  </button>
                )}
              </Menu.Item>
            </div>
            <div className="px-1 py-1 ">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${
                      active ? "bg-red-500 text-white" : "text-gray-900"
                    } group flex w-full items-center rounded px-2 py-2 text-sm`}
                  >
                    <MdToday className="mr-2 h-5 w-5" aria-hidden="true" />
                    Trier par date d&apos;échéance
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
    </div>
  );
}

export default SearchBar;
