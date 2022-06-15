import Link from "next/link";
import Router from "next/router";
import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";

import { DotsHorizontalIcon, TrashIcon } from "@heroicons/react/solid";
import { classNames } from "../lib/utils";
import { createForm, useForms } from "../lib/forms";

export default function FormList() {
  const { forms, mutateForms } = useForms();

  const newForm = async () => {
    const form = await createForm();
    await Router.push(`/forms/${form.id}/form`);
  };

  const deleteForm = async (form, formIdx) => {
    try {
      await fetch(`/api/forms/${form.id}`, {
        method: "DELETE",
      });
      // remove locally
      const updatedForms = [...forms];
      updatedForms.splice(formIdx, 1);
      mutateForms(updatedForms);
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <div>
      {forms && (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <button onClick={() => newForm()}>
            <li className="col-span-1">
              <div className="overflow-hidden text-white rounded-lg shadow bg-snoopred">
                <div className="px-4 py-8 sm:p-10">+ New Form</div>
              </div>
            </li>
          </button>
          {forms
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((form, formIdx) => (
              <li key={form.id} className="col-span-1 ">
                <div className="bg-white divide-y rounded-lg shadow divide-lightgray-200">
                  <Link href={`/forms/${form.id}`}>
                    <a>
                      <div className="px-4 py-5 sm:p-6">{form.name}</div>
                    </a>
                  </Link>
                  <div className="px-4 py-1 text-right sm:px-6">
                    <Menu as="div" className="relative inline-block text-left">
                      {({ open }) => (
                        <>
                          <div>
                            <Menu.Button className="flex items-center p-2 -m-2 rounded-full text-darkgray-400 hover:text-darkgray-500-600 focus:outline-none">
                              <span className="sr-only">Open options</span>
                              <DotsHorizontalIcon
                                className="w-5 h-5"
                                aria-hidden="true"
                              />
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
                              className="absolute left-0 w-56 mt-2 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                            >
                              <div className="py-1">
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      onClick={() => deleteForm(form, formIdx)}
                                      className={classNames(
                                        active
                                          ? "bg-lightgray-100 text-darkgray-700"
                                          : "text-darkgray-500",
                                        "flex px-4 py-2 text-sm w-full"
                                      )}
                                    >
                                      <TrashIcon
                                        className="w-5 h-5 mr-3 text-darkgray-400"
                                        aria-hidden="true"
                                      />
                                      <span>Delete Form</span>
                                    </button>
                                  )}
                                </Menu.Item>
                              </div>
                            </Menu.Items>
                          </Transition>
                        </>
                      )}
                    </Menu>
                  </div>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
