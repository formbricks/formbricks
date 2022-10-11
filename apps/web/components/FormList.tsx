import { Menu, Transition } from "@headlessui/react";
import { DocumentPlusIcon, PlusIcon, CommandLineIcon, SquaresPlusIcon } from "@heroicons/react/24/outline";
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
                hasButton={true}>
                <DocumentPlusIcon className="text-ui-gray-medium stroke-thin mx-auto h-24 w-24" />
              </EmptyPageFiller>
            </div>
          ) : (
            <ul className="grid grid-cols-2 place-content-stretch gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ">
              <button onClick={() => newForm()}>
                <li className="col-span-1 h-56">
                  <div className="bg-snoopfade flex h-full items-center justify-center overflow-hidden rounded-md font-light text-white shadow">
                    <div className="px-4 py-8 sm:p-14">
                      <PlusIcon className="stroke-thin mx-auto h-14 w-14" />
                      create form
                    </div>
                  </div>
                </li>
              </button>
              {forms
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((form, formIdx) => (
                  <li key={form.id} className="relative col-span-1 h-56">
                    <div className="flex h-full flex-col justify-between rounded-md bg-white shadow">
                      <div className="p-6">
                        <p className="line-clamp-3 text-lg">{form.name}</p>
                      </div>
                      <Link href={`/forms/${form.id}`}>
                        <a className="absolute h-full w-full" />
                      </Link>
                      <div className="divide-ui-gray-light divide-y ">
                        <div className="bg-ui-gray-light text-ui-gray-dark mb-2 ml-4 inline-flex rounded-sm px-2 py-1 text-sm">
                          {form.formType == "NOCODE" ? (
                            <div className="flex">
                              <SquaresPlusIcon className="my-auto mr-1 h-4 w-4" />
                              No-Code
                            </div>
                          ) : (
                            <div className="flex">
                              <CommandLineIcon className="my-auto mr-1 h-4 w-4" />
                              Code
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between px-4 py-2 text-right sm:px-6">
                          <p className="text-ui-gray-medium text-xs ">
                            {form._count?.submissionSessions} responses
                          </p>
                          <Menu as="div" className="relative z-10 inline-block text-left">
                            {({ open }) => (
                              <>
                                <div>
                                  <Menu.Button className="text-red -m-2 flex items-center rounded-full p-2">
                                    <span className="sr-only">Open options</span>
                                    <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" />
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
                                    className="absolute left-0 mt-2 w-56 origin-top-right rounded-sm bg-white px-1 shadow-lg">
                                    <div className="py-1">
                                      <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={() => deleteForm(form, formIdx)}
                                            className={classNames(
                                              active
                                                ? "bg-ui-gray-light text-ui-black rounded-sm"
                                                : "text-ui-gray-dark",
                                              "flex w-full px-4 py-2 text-sm"
                                            )}>
                                            <TrashIcon
                                              className="text-ui-gray-dark mr-3 h-5 w-5"
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
