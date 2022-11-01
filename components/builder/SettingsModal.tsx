/* This example requires Tailwind CSS v2.0+ */
import { Dialog, Switch, Listbox, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { TailSpin } from "react-loader-spinner";
import Loading from "../Loading";
import {
  XMarkIcon,
  CheckIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { classNames } from "../../lib/utils";
import format from "date-fns/format";
import { persistForm, useForm } from "../../lib/forms";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import { FormOrder } from "@prisma/client";
//HiRefresh

export default function SettingsModal({ open, setOpen, formId }) {
  const { form, mutateForm } = useForm(formId);
  const { noCodeForm, mutateNoCodeForm, isLoadingNoCodeForm } =
    useNoCodeForm(formId);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(form.name);
  const [dueDate, setDueDate] = useState(form.dueDate);
  const [description, setDescription] = useState(form.description);
  const [answeringOrder, setAnsweringOrder] = useState(form.answeringOrder);

  const answeringOptions = [
    FormOrder.RANDOM,
    FormOrder.SEQUENTIAL,
    FormOrder.ABTEST,
  ];

  const handleBlurInputs = async (inputName: any) => {
    const newForm = JSON.parse(JSON.stringify(form));
    inputName === "dueDate"
      ? (newForm.dueDate = new Date(dueDate))
      : inputName === "name"
      ? (newForm.name = name)
      : inputName === "answeringOrder"
      ? (newForm.answeringOrder = answeringOrder)
      : (newForm.description = description);
    await persistForm(newForm);
    mutateForm(newForm);
    toast(`Your sourcing has been updated successfully 🎉`);
  };

  const toggleClose = async () => {
    setLoading(true);
    setTimeout(async () => {
      const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
      newNoCodeForm.closed = !noCodeForm.closed;
      await persistNoCodeForm(newNoCodeForm);
      mutateNoCodeForm(newNoCodeForm);
      setLoading(false);
      toast(
        newNoCodeForm.closed
          ? "Your sourcing is now closed for submissions "
          : "Your sourcing is now open for submissions 🎉"
      );
    }, 500);
  };

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

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
          <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />
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
              <Dialog.Panel className="relative px-4 pt-5 pb-4 overflow-hidden text-left transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:max-w-4xl sm:w-full sm:p-6">
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    onClick={() => setOpen(false)}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="px-4 py-5 sm:p-6">
                  <div className="mb-4">
                    <h1 className="text-2xl font-medium leading-6 text-gray-900">
                      Settings
                    </h1>
                  </div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Details
                  </h3>
                  <form className="w-full mt-2 text-sm text-gray-900">
                    <div className="mt-1">
                      <label htmlFor="name" className="text-sm text-gray-500">
                        Nom du sourcing
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="name"
                          className="block w-full p-2 mb-6 border-none rounded bg-ui-gray-light focus:ring-2 focus:ring-red sm:text-sm placeholder:font-extralight placeholder:text-ui-gray-medium"
                          placeholder="e.g. Customer Research Survey"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onBlur={(e) => handleBlurInputs(e.target.name)}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-1">
                      <label
                        htmlFor="dueDate"
                        className="text-sm text-gray-500"
                      >
                        Date limite de votre sourcing
                      </label>
                      <div className="mt-1">
                        <input
                          type="date"
                          name="dueDate"
                          className="block w-full p-2 mb-6 border-none rounded bg-ui-gray-light focus:ring-2 focus:ring-red sm:text-sm placeholder:font-extralight placeholder:text-ui-gray-medium"
                          placeholder="e.g. mm/dd/yyyy"
                          value={format(new Date(dueDate), "yyyy-MM-dd")}
                          onChange={(e) => setDueDate(e.target.value)}
                          onBlur={(e) => handleBlurInputs(e.target.name)}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-1">
                      <label
                        htmlFor="description"
                        className="text-sm text-gray-500"
                      >
                        Décrivez votre sourcing
                      </label>
                      <div className="mt-1">
                        <textarea
                          name="description"
                          id="description"
                          value={description}
                          autoFocus
                          onChange={(e) => setDescription(e.target.value)}
                          onBlur={(e) => handleBlurInputs(e.target.name)}
                          cols={30}
                          rows={5}
                          className="resize-none block w-full p-2 mb-6 border-none rounded bg-ui-gray-light focus:ring-2 focus:ring-red sm:text-sm placeholder:font-extralight placeholder:text-ui-gray-medium"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                    <label
                      htmlFor="answeringOrder"
                      className="text-sm font-light text-ui-gray-dark"
                    >
                      Définissez l&apos;ordre des étapes de votre sourcing
                    </label>
                      <Listbox
                        value={answeringOrder}
                        name="answeringOrder"
                        onChange={(e) => setAnsweringOrder(e)}
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
                                  onChange={() => setAnsweringOrder(option)}
                                  onBlur={() =>
                                    handleBlurInputs("answeringOrder")
                                  }
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
                  </form>
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Accès
                  </h3>
                  <div className="w-full mt-2 text-sm text-gray-500">
                    <Switch.Group
                      as="div"
                      className="flex items-center justify-between w-full"
                    >
                      <span className="flex flex-col flex-grow">
                        <Switch.Label
                          as="span"
                          className="text-sm font-medium text-gray-900"
                          passive={true}
                        >
                          Fermer le sourcing ?
                        </Switch.Label>
                        <Switch.Description
                          as="span"
                          className="text-sm text-gray-500"
                        >
                          Votre sourcing est actuellement{" "}
                          <span className="font-bold">
                            {noCodeForm.closed ? "fermé" : "ouvert"}
                          </span>{" "}
                          pour les soumissions.
                        </Switch.Description>
                      </span>
                      {loading ? (
                        <TailSpin color="#1f2937" height={30} width={30} />
                      ) : (
                        <Switch
                          checked={noCodeForm.closed}
                          onChange={() => toggleClose()}
                          className={classNames(
                            noCodeForm.closed ? "bg-red-600" : "bg-gray-200",
                            "relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={classNames(
                              noCodeForm.closed
                                ? "translate-x-5"
                                : "translate-x-0",
                              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200"
                            )}
                          />
                        </Switch>
                      )}
                    </Switch.Group>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
