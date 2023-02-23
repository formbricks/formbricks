import { Menu, Transition } from "@headlessui/react";
import {
  ArrowLeftOnRectangleIcon,
  UserIcon,
  CogIcon,
} from "@heroicons/react/24/solid";
import { signOut, useSession } from "next-auth/react";
import { Fragment, useState } from "react";
import { classNames, upload } from "../../lib/utils";
import { DRCProvinces } from "../../lib/enums";
import Modal from "../Modal";
import {
  updateUserProfile,
  updateAddress,
} from "../../lib/users";
import { toast } from "react-toastify";
import { useRouter } from "next/router";

export default function MenuProfile({}) {
  const router = useRouter();
  const session = useSession();
  const { user } = session.data;
  const [open, setOpen] = useState(false);
  const onClickSettings = () => {
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = e.target.elements.profilPic.files[0];
    let pictureProfile;
    file ? (pictureProfile = (await upload(file)).Location) : "";

    try {
      await updateAddress({
        id: user.addressId,
        line1: e.target.elements.line1.value,
        line2: e.target.elements.line2.value,
        ville: e.target.elements.ville.value,
        province: e.target.elements.province.value,
        commune: e.target.elements.commune.value,
      });
      await updateUserProfile({
        id: user.id,
        pictureProfile: pictureProfile,
        password: e.target.elements.password.value,
        phone: e.target.elements.phone.value,
        whatsapp: e.target.elements.whatsapp.value,
      });
      const url = `/`;
      router.push(url);
    } catch (e) {
      toast(e.message);
    }
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
                    src={user.photo}
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
                className="absolute right-0 w-48 p-1 mt-2 origin-top-right bg-white rounded-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none break-words"
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
                        {user.firstname}{" "}{user.lastname}
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
                        Paramètres
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

      <Modal open={open} setOpen={setOpen}>
        <div>
          <figure>
            <img className="w-24 h-24 rounded-full mx-auto" src={user.photo} />
            <figcaption className="font-medium">
              <div className="text-2xl font-bold mb-2">{user.firstname}{" "}{user.lastname}</div>
            </figcaption>
          </figure>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="">
            <hr />
            <h1 className="mt-2 mb-2 font-bold text-center text-ui-gray-dark max-sm:ml-6 max-md:ml-6 max-sm:mt-8 max-md:mb-8 ">
              Modifiez vos informations
            </h1>
            <hr />
            <div className="mt-3 mb-2">
              <label className="block text-sm font-medium text-ui-gray-dark">
                Photo de profil
              </label>
              <input
                name="profilPic"
                id="profilPic"
                accept="image/x-png,image/jpg,image/jpeg"
                className=" m-0 block w-full min-w-0 flex-auto cursor-pointer rounded border border-solid border-neutral-300 bg-white bg-clip-padding px-3 py-1.5 text-base font-normal text-neutral-700 outline-none transition duration-300 ease-in-out file:-mx-3 file:-my-1.5 file:cursor-pointer file:overflow-hidden file:rounded-none file:border-0 file:border-solid file:border-inherit file:px-3 file:py-1.5 file:text-neutral-700 file:transition file:duration-150 file:ease-in-out file:[margin-inline-end:0.75rem] file:[border-inline-end-width:1px] hover:file:bg-neutral-200 focus:border-primary focus:bg-white focus:text-neutral-700 focus:shadow-[0_0_0_1px] focus:shadow-primary focus:outline-none dark:bg-transparent dark:text-neutral-200 dark:focus:bg-transparent"
                type="file"
              />
            </div>

            <div className="mt-1">
              <label className="block text-sm font-medium text-ui-gray-dark">
                Nouveau numéro de téléphone
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                placeholder={user.phone}
                className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
              />
            </div>

            <div className="mt-1">
              <label className="block text-sm font-medium text-ui-gray-dark">
                Nouveau numéro whatsapp
              </label>
              <input
                id="whatsapp"
                name="whatsapp"
                type="text"
                placeholder={user.whatsapp}
                className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-ui-gray-dark">
                Mot de passe
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••••"
                  className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                />
              </div>
            </div>
            <div className="mt-3">
              <label
                htmlFor="address"
                className="block text-sm font-medium text-ui-gray-dark"
              >
                Adresse
              </label>
              <div className="mt-1">
                <input
                  id="line1"
                  name="line1"
                  type="text"
                  placeholder={user.address.line1? user.address.line1 : "Addresse 1"}
                  className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                />
              </div>

              <div className="mt-1">
                <input
                  id="line2"
                  name="line2"
                  type="text"
                  placeholder={user.address.line2? user.address.line2 : "Addresse 2"}
                  className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                />
              </div>

              <div className="mt-1">
                <input
                  id="commune"
                  name="commune"
                  type="text"
                  placeholder={user.address.commune? user.address.commune : "Commune"}
                  className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                />
              </div>

              <div className="mt-1">
                <input
                  id="ville"
                  name="ville"
                  type="text"
                  placeholder={user.address.ville? user.address.ville : "Ville"}

                  className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                />
              </div>

              <div className="mt-1">
                <select
                  name="province"
                  id="province"
                  className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                >
                  <option value="">Province</option>
                  {Object.keys(DRCProvinces).map((province) => (
                    <option value={province}>{DRCProvinces[province]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <button
                type="submit"
                className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm bg-red hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
