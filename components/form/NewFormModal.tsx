/* This example requires Tailwind CSS v2.0+ */
import { Dialog, Transition, Listbox } from "@headlessui/react";
import {
  XMarkIcon,
  ChevronUpDownIcon,
  CheckIcon,
} from "@heroicons/react/24/solid";
import { FormOrder } from "@prisma/client";
import { useRouter } from "next/router";
import { Fragment, useState } from "react";
import { BsPlus } from "react-icons/bs";
import { createForm } from "../../lib/forms";
import { createNoCodeForm } from "../../lib/noCodeForm";
import StandardButton from "../StandardButton";

const answeringOptions = [
  FormOrder.RANDOM,
  FormOrder.SEQUENTIAL,
  FormOrder.ABTEST,
];

const places = [
  { name: "Kinshasa" },
  { name: "Goma" },
  { name: "Lubumbashi" },
  { name: "Other" },
];

type FormOnboardingModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

export default function NewFormModal({
  open,
  setOpen,
}: FormOnboardingModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(places[0]);
  const [answeringOrder, setAnsweringOrder] = useState(FormOrder.RANDOM);

  const createFormAction = async (e) => {
    e.preventDefault();
    const form = await createForm({
      name,
      dueDate: new Date(dueDate),
      description,
      place: selectedPlace.name,
      answeringOrder,
    });

    if (form.formType === "NOCODE") {
      await createNoCodeForm(form.id);
    }

    router.push(`/forms/${form.id}/form`);
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-30 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-full p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative px-4 pt-5 pb-4 text-left transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:max-w-lg sm:w-full sm:p-6">
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-0 focus:ring-offset-2"
                    onClick={() => setOpen(false)}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex flex-row justify-between">
                  <h2 className="flex-none p-2 text-xl font-bold text-ui-gray-dark">
                    Créer un sourcing
                  </h2>
                </div>
                <form
                  onSubmit={(e) => createFormAction(e)}
                  className="inline-block w-full p-2 overflow-hidden text-left align-bottom transition-all transform sm:align-middle"
                >
                  <div>
                    <label
                      htmlFor="name"
                      className="text-sm font-light text-ui-gray-dark"
                    >
                      Nom du sourcing
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        name="name"
                        className="block w-full p-2 mb-6 border-none rounded bg-ui-gray-light focus:ring-2 focus:ring-red sm:text-sm placeholder:font-extralight placeholder:text-ui-gray-medium"
                        placeholder="e.g. Customer Research Survey"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="answeringOrder"
                      className="text-sm font-light text-ui-gray-dark"
                    >
                      Définissez l&apos;ordre des étapes de votre sourcing
                    </label>
                    <div className="mt-2">
                      <Listbox
                        value={answeringOrder}
                        onChange={setAnsweringOrder}
                      >
                        <Listbox.Button className="relative w-full cursor-default rounded bg-ui-gray-light py-2 pl-3 pr-10 text-left focus:ring-2 focus:ring-red sm:text-sm">
                          <span className="block truncate">
                            {answeringOrder}
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronUpDownIcon
                              className="h-5 w-5 text-gray-400"
                              aria-hidden="true"
                            />
                          </span>
                        </Listbox.Button>
                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                            {answeringOptions.map((option, optionIdx) => {
                              return (
                                <Listbox.Option
                                  key={optionIdx}
                                  value={option}
                                  className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                      active
                                        ? "bg-red-500 text-white"
                                        : "text-gray-900"
                                    }`
                                  }
                                >
                                  {({ selected }) => (
                                    <>
                                      <span
                                        className={`block truncate ${
                                          selected
                                            ? "font-medium"
                                            : "font-normal"
                                        }`}
                                      >
                                        {option}
                                      </span>

                                      {selected ? (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white-600">
                                          <CheckIcon
                                            className="h-5 w-5"
                                            aria-hidden="true"
                                          />
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </Listbox.Option>
                              );
                            })}
                          </Listbox.Options>
                        </Transition>
                      </Listbox>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="dueDate"
                      className="text-sm font-light text-ui-gray-dark"
                    >
                      Date limite de votre sourcing
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        name="dueDate"
                        className="block w-full p-2 mb-6 border-none rounded bg-ui-gray-light focus:ring-2 focus:ring-red sm:text-sm placeholder:font-extralight placeholder:text-ui-gray-medium"
                        placeholder="e.g. mm/dd/yyyy"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        onFocus={(e) => (e.target.type = "date")}
                        onBlur={(e) => (e.target.type = "text")}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="place"
                      className="text-sm font-light text-ui-gray-dark"
                    >
                      Définissez le lieu de votre sourcing
                    </label>
                    <div className="mt-2">
                      <Listbox
                        value={selectedPlace}
                        onChange={setSelectedPlace}
                      >
                        <Listbox.Button className="relative w-full cursor-default rounded bg-ui-gray-light py-2 pl-3 pr-10 text-left focus:ring-2 focus:ring-red sm:text-sm">
                          <span className="block truncate">
                            {selectedPlace.name}
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronUpDownIcon
                              className="h-5 w-5 text-gray-400"
                              aria-hidden="true"
                            />
                          </span>
                        </Listbox.Button>
                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                            {places.map((place, placeIdx) => {
                              return (
                                <Listbox.Option
                                  key={placeIdx}
                                  value={place}
                                  className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                      active
                                        ? "bg-red-500 text-white"
                                        : "text-gray-900"
                                    }`
                                  }
                                >
                                  {({ selected }) => (
                                    <>
                                      <span
                                        className={`block truncate ${
                                          selected
                                            ? "font-medium"
                                            : "font-normal"
                                        }`}
                                      >
                                        {place.name}
                                      </span>

                                      {selected ? (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white-600">
                                          <CheckIcon
                                            className="h-5 w-5"
                                            aria-hidden="true"
                                          />
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </Listbox.Option>
                              );
                            })}
                          </Listbox.Options>
                        </Transition>
                      </Listbox>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="description"
                      className="text-sm font-light text-ui-gray-dark"
                    >
                      Description du sourcing
                    </label>
                    <div className="mt-2">
                      <textarea
                        name="description"
                        id="description"
                        value={description}
                        autoFocus
                        onChange={(e) => setDescription(e.target.value)}
                        cols={30}
                        rows={5}
                        className="resize-none block w-full p-2 mb-6 border-none rounded bg-ui-gray-light focus:ring-2 focus:ring-red sm:text-sm placeholder:font-extralight placeholder:text-ui-gray-medium"
                      />
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6">
                    <StandardButton fullwidth type="submit">
                      Nouveau Sourcing
                      <BsPlus className="w-6 h-6 ml-1" />
                    </StandardButton>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
