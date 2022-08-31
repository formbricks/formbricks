import { Menu, Transition } from "@headlessui/react";
import {
  DocumentPlusIcon,
  PlusIcon,
  CommandLineIcon,
  SquaresPlusIcon,
} from "@heroicons/react/24/outline";
import { EllipsisHorizontalIcon, TrashIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { Fragment, useState } from "react";
import { useForms } from "../lib/forms";
import { classNames } from "../lib/utils";
import NewFormModal from "./form/NewFormModal";
import EmptyPageFiller from "./layout/EmptyPageFiller";

export default function FormList() {
  const { forms, mutateForms } = useForms();
  const [openNewFormModal, setOpenNewFormModal] = useState(false);

  const newForm = async () => {
    setOpenNewFormModal(true);
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
    <>
      <div className="h-full px-6 py-8">
        {forms &&
          (forms.length === 0 ? (
            <div className="mt-5 text-center">
              <EmptyPageFiller
                onClick={() => newForm()}
                alertText="You don't have any forms yet."
                hintText="Start by creating a form."
                buttonText="create form"
                borderStyles="border-4 border-dotted border-red"
                hasButton={true}
              >
                <DocumentPlusIcon className="w-24 h-24 mx-auto text-ui-gray-medium stroke-thin" />
              </EmptyPageFiller>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 place-content-stretch ">
              <button onClick={() => newForm()}>
                <li className="h-56 col-span-1">
                  <div className="flex items-center justify-center h-full overflow-hidden font-light text-white rounded-md shadow bg-snoopfade">
                    <div className="px-4 py-8 sm:p-14">
                      <PlusIcon className="mx-auto w-14 h-14 stroke-thin" />
                      create form
                    </div>
                  </div>
                </li>
              </button>
              {forms
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((form, formIdx) => (
                  <li key={form.id} className="relative h-56 col-span-1">
                    <div className="flex flex-col justify-between h-full bg-white rounded-md shadow">
                      <div className="p-6">
                        <p className="text-lg line-clamp-3">{form.name}</p>
                      </div>
                      <Link href={`/forms/${form.id}`}>
                        <a className="absolute w-full h-full" />
                      </Link>
                      <div className="divide-y divide-ui-gray-light ">
                        <div className="inline-flex px-2 py-1 mb-2 ml-4 text-sm rounded-sm bg-ui-gray-light text-ui-gray-dark">
                          {form.formType == "NOCODE" ? (
                            <div className="flex">
                              <SquaresPlusIcon className="w-4 h-4 my-auto mr-1" />
                              No-Code
                            </div>
                          ) : (
                            <div className="flex">
                              <CommandLineIcon className="w-4 h-4 my-auto mr-1" />
                              Code
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between px-4 py-2 text-right sm:px-6">
                          <p className="text-xs text-ui-gray-medium ">
                            {form._count?.submissionSessions} responses
                          </p>
                          <Menu
                            as="div"
                            className="relative z-10 inline-block text-left"
                          >
                            {({ open }) => (
                              <>
                                <div>
                                  <Menu.Button className="flex items-center p-2 -m-2 rounded-full text-red">
                                    <span className="sr-only">
                                      Open options
                                    </span>
                                    <EllipsisHorizontalIcon
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
                                    className="absolute left-0 w-56 px-1 mt-2 origin-top-right bg-white rounded-sm shadow-lg"
                                  >
                                    <div className="py-1">
                                      <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={() =>
                                              deleteForm(form, formIdx)
                                            }
                                            className={classNames(
                                              active
                                                ? "bg-ui-gray-light rounded-sm text-ui-black"
                                                : "text-ui-gray-dark",
                                              "flex px-4 py-2 text-sm w-full"
                                            )}
                                          >
                                            <TrashIcon
                                              className="w-5 h-5 mr-3 text-ui-gray-dark"
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
                    </div>
                  </li>
                ))}
            </ul>
          ))}
      </div>
      <NewFormModal open={openNewFormModal} setOpen={setOpenNewFormModal} />
    </>
  );
}
