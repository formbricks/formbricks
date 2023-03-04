import React from "react";
import { updateUserProfile, updateAddress } from "../../lib/users";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
import { PencilIcon } from "@heroicons/react/24/solid";
import { useSession } from "next-auth/react";
import { useState, useRef } from "react";
import { upload } from "../../lib/utils";
import { DRCProvinces } from "../../lib/enums";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function UpdateProfile() {
  const router = useRouter();
  const session = useSession();
  const { user } = session.data;
  const [fileName, setFileName] = useState("");
  const inputFileRef = useRef(null);
  const [firstName, setFirstName] = useState(user.firstname);
  const [lastName, setLastName] = useState(user.lastname);
  const [phone, setPhone] = useState(user.phone);
  const [whatsapp, setWhatsapp] = useState(user.whatsapp);
  const [line1, setLine1] = useState(user.address.line1);
  const [line2, setLine2] = useState(user.address.line2);
  const [commune, setCommune] = useState(user.address.commune);
  const [ville, setVille] = useState(user.address.ville);

  const handleInputChange = (e) => {
    const name = e.target.name;
    switch (name) {
      case "firstname":
        setFirstName(e.target.value);
        break;
      case "lastname":
        setLastName(e.target.value);
        break;
      case "phone":
        setPhone(e.target.value);
        break;
      case "whatsapp":
        setWhatsapp(e.target.value);
        break;
      case "line1":
        setLine1(e.target.value);
        break;
      case "line2":
        setLine2(e.target.value);
        break;
      case "commune":
        setCommune(e.target.value);
        break;
      case "ville":
        setVille(e.target.value);
        break;
    }
  };

  const handleInputFileClick = () => {
    inputFileRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
      const fileSize = e.target.files[0].size / 1024;
      if (fileSize > 1024) {
        toast("Le fichier ne doit pas depasser 1MB");
        inputFileRef.current.value = null;
        setFileName("");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = e.target.elements.profilPic.files[0];
    let photo;
    file ? (photo = (await upload(file)).Location) : "";

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
        firstname: e.target.elements.firstname.value,
        lastname: e.target.elements.lastname.value,
        photo: photo,
        phone: e.target.elements.phone.value,
        whatsapp: e.target.elements.whatsapp.value,
      });
      const next = router.query.next
      router.push(`${next}`);
    
    } catch (e) {
      toast(e.message);
    }
  };
  return (
    <BaseLayoutUnauthorized title="Update Profile">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <div className="mt-8 flex-col flex items-center">
              
                <div
                  className="relative cursor-pointer "
                  onClick={handleInputFileClick}
                >
                  <figure>
                    <img
                      className="w-24 h-24 rounded-full mx-auto"
                      src={
                        user.photo ? user.photo : "/img/avatar-placeholder.png"
                      }
                    />
                    <figcaption
                      className="absolute bottom-0 right-0 px-1 py-1 font-medium text-white border border-transparent rounded-md shadow-sm bg-red hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      style={{ fontSize: 10 }}
                    >
                      <PencilIcon className="w-4 h-4" aria-hidden="true" />
                    </figcaption>
                  </figure>
                </div>
                <div className="text-center">
                  <code className="text-xs ">{fileName}</code>
                </div>
                <div className="text-2xl font-bold text-center mb-2 mt-3 text-ui-gray-dark">
                  {user.firstname} {user.lastname}
                </div>
              

              <div className="mt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="">
                    <hr />
                    <h1 className="mt-2 mb-2 font-bold text-center text-ui-gray-dark max-sm:ml-6 max-md:ml-6 max-sm:mt-8 max-md:mb-8 ">
                      Complétez votre profil
                    </h1>
                    <hr />
                    <div className="mt-3 mb-2">
                      <input
                        name="profilPic"
                        id="profilPic"
                        ref={inputFileRef}
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                        accept="image/x-png,image/jpg,image/jpeg"
                        className=" m-0 block w-full min-w-0 flex-auto cursor-pointer rounded border border-solid border-neutral-300 bg-white bg-clip-padding px-3 py-1.5 text-base font-normal text-neutral-700 outline-none transition duration-300 ease-in-out file:-mx-3 file:-my-1.5 file:cursor-pointer file:overflow-hidden file:rounded-none file:border-0 file:border-solid file:border-inherit file:px-3 file:py-1.5 file:text-neutral-700 file:transition file:duration-150 file:ease-in-out file:[margin-inline-end:0.75rem] file:[border-inline-end-width:1px] hover:file:bg-neutral-200 focus:border-primary focus:bg-white focus:text-neutral-700 focus:shadow-[0_0_0_1px] focus:shadow-primary focus:outline-none dark:bg-transparent dark:text-neutral-200 dark:focus:bg-transparent"
                        type="file"
                      />
                    </div>

                    <div className="mt-1">
                      <label className="block text-sm font-medium text-ui-gray-dark">
                        Nom
                      </label>
                      <input
                        id="firstname"
                        name="firstname"
                        type="text"
                        required
                        value={firstName}
                        onChange={handleInputChange}
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>

                    <div className="mt-1">
                      <label className="block text-sm font-medium text-ui-gray-dark">
                        Post-Nom
                      </label>
                      <input
                        id="lastname"
                        name="lastname"
                        value={lastName}
                        required
                        onChange={handleInputChange}
                        type="text"
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>

                    <div className="mt-1">
                      <label className="block text-sm font-medium text-ui-gray-dark">
                        Numéro de téléphone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="text"
                        value={phone}
                        required
                        onChange={handleInputChange}
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>

                    <div className="mt-1">
                      <label className="block text-sm font-medium text-ui-gray-dark">
                        Numéro whatsapp
                      </label>
                      <input
                        id="whatsapp"
                        name="whatsapp"
                        type="text"
                        required
                        value={whatsapp}
                        onChange={handleInputChange}
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
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
                          required
                          value={line1}
                          onChange={handleInputChange}
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>

                      <div className="mt-1">
                        <input
                          id="line2"
                          name="line2"
                          type="text"
                          value={line2}
                          required
                          onChange={handleInputChange}
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>

                      <div className="mt-1">
                        <input
                          id="commune"
                          name="commune"
                          type="text"
                          value={commune}
                          required
                          onChange={handleInputChange}
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>

                      <div className="mt-1">
                        <input
                          id="ville"
                          name="ville"
                          type="text"
                          value={ville}
                          required
                          onChange={handleInputChange}
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>

                      <div className="mt-1">
                        <select
                          name="province"
                          id="province"
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        >
                          <option
                            selected
                            disabled
                            hidden
                            className="block text-sm font-medium text-ui-gray-dark"
                          >
                            {DRCProvinces[user.address.province]}
                          </option>
                          {Object.keys(DRCProvinces).map((province) => (
                            <option value={province}>
                              {DRCProvinces[province]}
                            </option>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
