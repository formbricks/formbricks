import { Menu, Transition } from "@headlessui/react";
import { ArrowLeftOnRectangleIcon } from "@heroicons/react/24/solid";
import { signOut } from "next-auth/react";
import Image from "next/legacy/image";
import { Fragment } from "react";
import { classNames } from "../../lib/utils";

export default function MenuProfile({}) {
  return (
    <Menu as="div" className="relative z-50 flex-shrink-0">
      {({ open }) => (
        <>
          <div className="inline-flex items-center ">
            <Menu.Button className="ml-3 flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
              <span className="sr-only">Open user menu</span>
              <div className="h-8 w-8">
                <Image
                  className="rounded-full"
                  src="/img/avatar-placeholder.png"
                  alt="user avatar"
                  width={50}
                  height={50}
                />
              </div>
            </Menu.Button>
          </div>
          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95">
            <Menu.Items
              static
              className="absolute right-0 mt-2 w-48 origin-top-right rounded-sm bg-white p-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className={classNames(
                      active ? "bg-ui-gray-light text-ui-black rounded-sm" : "text-ui-gray-dark",
                      "flex w-full px-4 py-2 text-sm"
                    )}>
                    <ArrowLeftOnRectangleIcon className="text-ui-gray-dark mr-3 h-5 w-5" aria-hidden="true" />
                    Sign Out
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  );
}
