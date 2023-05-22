import { Menu, Transition } from "@headlessui/react";
import {
  ArrowLeftOnRectangleIcon,
  UserIcon,
  CogIcon,
} from "@heroicons/react/24/solid";
import { signOut, useSession } from "next-auth/react";
import { Fragment, useState } from "react";
import { classNames } from "../../lib/utils";
import { useRouter } from "next/router";

export default function MenuProfile({}) {
  const router = useRouter();
  const session = useSession();
  const { user } = session.data;
  const { asPath } = router;

  const onClickSettings = () => {
    router.push({
      pathname: `/users/update-profile`,
      query: {next : asPath} 
    });
  };

  return (
    <>
      <Menu as="div" className="relative z-50 flex-shrink-0">
        {({ open }) => (
          <>
            <div className="inline-flex items-center ">
              <Menu.Button className="flex ml-3 text-sm bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                <span className="sr-only">Open user menu</span>
                <div className="w-8 h-8">
                  <img
                    className="rounded-full"
                    src={
                      user.photo ? user.photo : "/img/avatar-placeholder.png"
                    }
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
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items
                static
                className="absolute right-0 w-max	 p-1 mt-2 origin-top-right bg-white rounded-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none break-words"
              >
                <Menu.Item>
                  {({ active }) => (
                    <>
                      <label
                        className={classNames(
                          "flex px-4 py-2 text-sm w-full text-ui-gray-dark"
                        )}
                      >
                        <UserIcon
                          className="w-5 h-5 mr-3 text-ui-gray-dark"
                          aria-hidden="true"
                        />
                        {user.firstname} {user.lastname}
                      </label>
                      <hr />
                      <button
                        onClick={onClickSettings}
                        className={classNames(
                          active
                            ? "bg-ui-gray-light rounded-sm text-ui-black"
                            : "text-ui-gray-dark",
                          "flex px-4 py-2 text-sm w-full"
                        )}
                      >
                        <CogIcon
                          className="w-5 h-5 mr-3 text-ui-gray-dark"
                          aria-hidden="true"
                        />
                        Mettre à Jour
                      </button>
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className={classNames(
                          active
                            ? "bg-ui-gray-light rounded-sm text-ui-black"
                            : "text-ui-gray-dark",
                          "flex px-4 py-2 text-sm w-full"
                        )}
                      >
                        <ArrowLeftOnRectangleIcon
                          className="w-5 h-5 mr-3 text-ui-gray-dark"
                          aria-hidden="true"
                        />
                        Se déconnecter
                      </button>
                    </>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </>
        )}
      </Menu>
    </>
  );
}
