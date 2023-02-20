import { Menu, Transition } from "@headlessui/react";
import {
  PlusIcon,
  CalendarDaysIcon,
  FolderOpenIcon,
  DocumentPlusIcon,
  UserCircleIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { HiLocationMarker, HiDocumentDuplicate } from "react-icons/hi";
import { EllipsisHorizontalIcon, TrashIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { Fragment, useState, useEffect } from "react";
import { useForms } from "../lib/forms";
import { UserRole } from "@prisma/client";
import { useSession, signIn } from "next-auth/react";
import { classNames } from "../lib/utils";
import NewFormModal from "./form/NewFormModal";
import EmptyPageFiller from "./layout/EmptyPageFiller";
import { format } from "date-fns";
import CandidateProgress from "./form/CandidateProgress";
import { timeSince } from "../lib/utils";
import SearchBar from "./form/SearchBar";

import { fr } from "date-fns/locale";
import { SourcingFormations, SourcingLocations } from "../lib/enums";

export default function FormList() {
  const { forms, mutateForms } = useForms();
  const [openNewFormModal, setOpenNewFormModal] = useState(false);
  const [queryValue, setQueryValue] = useState("");
  const [formData, setFormData] = useState({});
  const [filteredData, setFilteredData] = useState(forms);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedFormation, setSelectedFormation] = useState("");

  const { data: session } = useSession({
    required: true,
    onUnauthenticated() {
      // The user is not authenticated, handle it here.
      return signIn();
    },
  });

  useEffect(() => {
    let filtering = filterByLocation(forms);
    filtering = filterByFormation(filtering);
    setFilteredData(filtering);
  }, [selectedFormation, selectedLocation, forms]);

  const dateDayDiff = (date) => {
    const today = new Date();
    const dueDate = new Date(date);
    var total_seconds = Math.abs(+dueDate - +today) / 1000;
    var days_difference = Math.floor(total_seconds / (60 * 60 * 24));
    return days_difference;
  };

  const filterByLocation = (filteredList) => {
    // Avoid filter for empty string
    if (!selectedLocation) {
      return filteredList;
    }

    const filteredData = filteredList.filter(
      (card) => card.place.split(" ").indexOf(selectedLocation) !== -1
    );
    return filteredData;
  };
  const filterByFormation = (filteredList) => {
    // Avoid filter for empty string
    return !selectedFormation
      ? filteredList
      : filteredList.filter(
          (card) => card.formation.split(" ").indexOf(selectedFormation) !== -1
        );
  };

  const handleChangeLocation = (event) => {
    setSelectedLocation(event.target.value);
  };
  const handleChangeFormation = (event) => {
    setSelectedFormation(event.target.value);
  };

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

  const duplicateForm = async (form) => {
    try {
      const data = await fetch(`/api/forms/${form.id}/duplicate`, {
        method: "POST",
        body: JSON.stringify({
          form,
        }),
      });
      const newForm = await data.json();

      const updatedForms = [...forms, newForm];
      mutateForms(updatedForms);
    } catch (error) {
      console.error(error);
    }
  };

  const filterSourcings = (button) => {
    if (button === "RESET") {
      setFilteredData(forms);
      setSelectedFormation("");
      setSelectedLocation("");
      return;
    }
  };
  return (
    <>
      {forms && forms.length > 100 ? (
        <SearchBar
          className='mt-5 flex gap-4'
          queryValue={queryValue}
          setQueryValue={setQueryValue}
          formData={formData}
          setFormData={setFormData}
        />
      ) : (
        <></>
      )}
      <div className='h-full px-6 py-8'>
        <div className='mb-10'>
          {session.user.role !== UserRole.ADMIN ? (
            <div className='flex flex-row'>
              <select
                className='flex justify-center text-sm font-medium text-black py-1 px-1 md:py-2 md:px-10 rounded-md shadow-sm border border-gray-300 bg-white rounded-md hover:border hover:border-black mr-1'
                value={selectedLocation}
                onChange={handleChangeLocation}
              >
                <option value=''>LIEU</option>
                {SourcingLocations.map((city, cityIndex) => (
                  <option key={cityIndex} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <select
                className='flex justify-center text-sm font-medium text-black py-1 px-6 md:py-2 md:px-10 rounded-md shadow-sm border border-gray-300 bg-white rounded-md hover:border hover:border-black mx-1'
                value={selectedFormation}
                onChange={handleChangeFormation}
              >
                <option value=''>FORMATION</option>
                {SourcingFormations.map((formation, formationIndex) => (
                  <option key={formationIndex} value={formation}>
                    {formation}
                  </option>
                ))}
              </select>
              <button
                className='flex justify-center text-sm font-medium py-2 px-2 md:py-2 md:px-10 rounded-md shadow-sm focus:outline-none focus:ring-2 bg-snoopfade text-white focus:ring-offset-2 focus:ring-red-500 mx-1'
                onClick={() => filterSourcings("RESET")}
              >
                RESET
              </button>
            </div>
          ) : (
            <></>
          )}
        </div>
        {filteredData &&
          (filteredData.length === 0 ? (
            <div className='mt-5 text-center'>
              {session.user.role !== UserRole.ADMIN ? (
                <EmptyPageFiller
                  alertText="Aucune session d'inscription trouvée."
                  hintText=''
                  borderStyles='border-4 border-dotted border-red'
                >
                  <FolderOpenIcon className='w-24 h-24 mx-auto text-ui-gray-medium stroke-thin' />
                </EmptyPageFiller>
              ) : (
                <EmptyPageFiller
                  onClick={() => newForm()}
                  alertText="Vous n'avez pas encore de sourcing"
                  hintText='Commencez par créer un sourcing'
                  buttonText='Nouveau Sourcing'
                  borderStyles='border-4 border-dotted border-red'
                  hasButton={true}
                >
                  <DocumentPlusIcon className='w-24 h-24 mx-auto text-ui-gray-medium stroke-thin' />
                </EmptyPageFiller>
              )}
            </div>
          ) : (
            <ul className='grid  max-sm:grid-cols-1  gap-6  max-md:grid-cols-2 max-lg:grid-cols-3 xl:grid-cols-3 place-content-stretch'>
              {session.user.role !== UserRole.ADMIN ? (
                <></>
              ) : (
                <button onClick={() => newForm()}>
                  <li className='h-80 col-span-1'>
                    <div className='flex items-center justify-center h-full overflow-hidden font-light text-white rounded shadow bg-snoopfade'>
                      <div className='px-4 py-8 sm:p-14'>
                        <PlusIcon className='mx-auto w-14 h-14 stroke-thin' />
                        Nouveau Sourcing
                      </div>
                    </div>
                  </li>
                </button>
              )}
              {filteredData
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((form, formIdx) => (
                  <li key={form.id} className='relative h-80 col-span-1'>
                    <div className='flex flex-col justify-between h-full border border-gray-300 bg-white rounded-md hover:border hover:border-black'>
                      <div className='p-6 h-2/5'>
                        <p className='text-2xl font-semibold line-clamp-3'>
                          {form.name}
                        </p>
                      </div>

                      <div className='h-2/5'>
                        <div className='px-6 mb-4'>
                          <hr />
                        </div>
                        {form.place === "" ? (
                          <></>
                        ) : (
                          <span className='flex items-center px-6 py-1 text-base font-bold text-black-title'>
                            <HiLocationMarker className='w-5 h-5 text-rose-500 mr-1 text-2xl' />
                            {form.place}
                          </span>
                        )}
                        <span className='flex items-center  px-6 py-1'>
                          <CalendarDaysIcon
                            className={
                              format(new Date(form.dueDate), "yyyy-MM-dd") ===
                              format(new Date(), "yyyy-MM-dd")
                                ? "w-5 h-5 text-red-800 mr-1 text-2xl"
                                : dateDayDiff(form.dueDate) > 7
                                ? "w-5 h-5 text-rose-500 mr-1 text-2xl"
                                : "w-5 h-5 text-rose-500 mr-1 text-2xl"
                            }
                          />
                          {format(new Date(form.dueDate), "yyyy-MM-dd") ===
                          format(new Date(), "yyyy-MM-dd") ? (
                            <span className='text-base font-normal text-red-800 font-normal line-clamp-3'>
                              Ferme aujourd&apos;hui
                            </span>
                          ) : dateDayDiff(form.dueDate) > 7 ? (
                            <span className='text-base font-normal text-black-title line-clamp-3'>
                              {format(new Date(form.dueDate), "dd MMMM yyyy", {
                                locale: fr,
                              })}
                            </span>
                          ) : (
                            <span className='text-base  text-rose-500 font-normal line-clamp-3 '>
                              {format(new Date(form.dueDate), "yyyy-MM-dd") <
                              format(new Date(), "yyyy-MM-dd")
                                ? "Fermé"
                                : "Ferme"}{" "}
                              {timeSince(form.dueDate)}
                            </span>
                          )}
                        </span>
                        {session.user.role === UserRole.ADMIN ? (
                          <span className='flex items-center px-6 py-1 text-base font-normal text-black-title'>
                            <UserCircleIcon className='w-5 h-5 text-rose-500 mr-1 text-2xl' />
                            {form.owner.firstname + " " + form.owner.lastname}
                          </span>
                        ) : (
                          <CandidateProgress form={form} />
                        )}
                      </div>

                      <Link
                        href={
                          session.user.role === UserRole.PUBLIC
                            ? `/sourcings/${form.id}`
                            : `/forms/${form.id}/form`
                        }
                      >
                        <a className='absolute w-full h-full' />
                      </Link>
                      <div className='divide-y divide-ui-gray-light '>
                        {session.user.role === UserRole.PUBLIC ? (
                          <></>
                        ) : (
                          <div className='flex justify-between px-6 py-2 text-right sm:px-6'>
                            <p className='flex gap-1 items-center text-xs text-ui-gray-medium '>
                              <EyeIcon className='w-3 h-3' />
                              <p>{form._count?.submissionSessions}</p>
                            </p>
                            <Menu
                              as='div'
                              className='relative z-10 inline-block text-left'
                            >
                              {({ open }) => (
                                <>
                                  <div>
                                    <Menu.Button className='flex items-center p-2 -m-2 rounded-full text-red'>
                                      <span className='sr-only'>
                                        Ouvrir les options
                                      </span>
                                      <EllipsisHorizontalIcon
                                        className='w-5 h-5'
                                        aria-hidden='true'
                                      />
                                    </Menu.Button>
                                  </div>

                                  <Transition
                                    show={open}
                                    as={Fragment}
                                    enter='transition ease-out duration-100'
                                    enterFrom='transform opacity-0 scale-95'
                                    enterTo='transform opacity-100 scale-100'
                                    leave='transition ease-in duration-75'
                                    leaveFrom='transform opacity-100 scale-100'
                                    leaveTo='transform opacity-0 scale-95'
                                  >
                                    <Menu.Items
                                      static
                                      className='absolute left-0 w-56 px-1 mt-2 origin-top-right bg-white rounded-sm shadow-lg'
                                    >
                                      <div className='py-1'>
                                        <Menu.Item>
                                          {({ active }) => (
                                            <>
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
                                                  className='w-5 h-5 mr-3 text-ui-gray-dark'
                                                  aria-hidden='true'
                                                />
                                                <span>Supprimer</span>
                                              </button>
                                              <button
                                                onClick={() =>
                                                  duplicateForm(form)
                                                }
                                                className={classNames(
                                                  active
                                                    ? "bg-ui-gray-light rounded-sm text-ui-black"
                                                    : "text-ui-gray-dark",
                                                  "flex px-4 py-2 text-sm w-full"
                                                )}
                                              >
                                                <HiDocumentDuplicate
                                                  className='w-5 h-5 mr-3 text-ui-gray-dark'
                                                  aria-hidden='true'
                                                />
                                                <span>Duplicate</span>
                                              </button>
                                            </>
                                          )}
                                        </Menu.Item>
                                      </div>
                                    </Menu.Items>
                                  </Transition>
                                </>
                              )}
                            </Menu>
                          </div>
                        )}
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
