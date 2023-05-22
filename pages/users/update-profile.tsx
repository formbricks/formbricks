import React, { useState, useRef, useEffect } from "react";
import { updateUser } from "../../lib/users";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
import { PencilIcon } from "@heroicons/react/24/solid";
import { useSession } from "next-auth/react";
import { upload } from "../../lib/utils";
import { DRCProvinces } from "../../lib/enums";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";
import { Address } from "@prisma/client";
import Loading from "../../components/Loading";

export default function UpdateProfile() {
  const router = useRouter();
  const { next } = router.query;
  const session = useSession();
  const [profilePictureFileName, setProfilePictureFileName] = useState("");
  const inputFileRef = useRef(null);
  const [user, setUser] = useState(null);
  const [address, setAddress] = useState<Address>(null);

  useEffect(() => {
    if (session.data) {
      setUser(session.data.user);
      if (session.data.user.address) {
        let add = session.data.user.address;
        delete add.userId;
        setAddress(add);
      }
    }
  }, [session]);

  const handleBlur = (e, source) => {
    if(e.target.value === "") toast.error("Renseignez votre " +`'${source}'`);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    const name = e.target.name;
    if (["line1", "line2", "commune", "ville", "province"].includes(name)) {
      setAddress({
        ...address,
        [name]: value,
      });
    } else {
      setUser({
        ...user,
        [e.target.name]: value,
      });
    }
  };

  const handleInputFileClick = () => {
    inputFileRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePictureFileName(e.target.files[0].name);
      const fileSize = e.target.files[0].size / 1024;
      if (fileSize > 1024) {
        toast.warn("Le fichier ne doit pas depasser 1MB");
        inputFileRef.current.value = null;
        setProfilePictureFileName("");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = e.target.elements.profilPic.files[0];
    let photo;
    file ? (photo = (await upload(file)).Location) : "";

    try {
      let userUpdateData = user;
        userUpdateData.dob = new Date(userUpdateData.dob);
        delete userUpdateData.address;
        const res = await updateUser(userUpdateData, address);

        if (res.status != 200) {
          toast.error("Erreur, veuillez ressayer");
        } else {
          session.data.user = userUpdateData
          session.data.user.address = address
          toast.success("Votre profil a bien été mis à jour");
          router.push(`/`);
        }
    } catch (e) {
      toast(e.message);
    }
  };

  if (!user) return <Loading />;

  return (
    <BaseLayoutUnauthorized title="Mise à jour profil">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <div
              className="w-fit m-auto relative cursor-pointer"
              onClick={handleInputFileClick}
            >
              <figure>
                <img
                  className="w-24 h-24 rounded-full mx-auto"
                  src={user.photo ? user.photo : "/img/avatar-placeholder.png"}
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
              <code className="text-xs ">{profilePictureFileName}</code>
            </div>
            <div>
              <div className="text-2xl font-bold text-center mb-2 mt-3 text-ui-gray-dark">
                {user.firstname} {user.lastname}
              </div>
              <p className="font-medium text-sm text-center mb-2 mt-3 text-red">{user.email}</p>
            </div>

            <div className="mt-4">
              <div className="mt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="">
                    <hr />
                    <h1 className="mt-2 mb-2 font-bold text-center text-ui-gray-dark max-sm:ml-6 max-md:ml-6 max-sm:mt-8 max-md:mb-8 ">
                      Complétez votre profil pour continuer
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
                        Prénom
                      </label>
                      <input
                        id="firstname"
                        name="firstname"
                        type="text"
                        required
                        placeholder="Jean"
                        value={user.firstname}
                        onChange={handleInputChange}
                        onBlur={(e) => handleBlur(e, "Prénom")}
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>

                    <div className="mt-1">
                      <label className="block text-sm font-medium text-ui-gray-dark">
                        Nom
                      </label>
                      <input
                        id="lastname"
                        name="lastname"
                        value={user.lastname}
                        required
                        placeholder="Kingandi"
                        onChange={handleInputChange}
                        onBlur={(e) => handleBlur(e, "Nom")}
                        type="text"
                        className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="dateOfBirth"
                        className="block text-sm font-medium text-ui-gray-dark"
                      >
                        Date de naissance
                      </label>
                      <div className="mt-1">
                        <input
                          id="dob"
                          name="dob"
                          value={user.dob ? user.dob.toString().substring(0, 10) : new Date().toISOString().substring(0, 10)}
                          onChange={handleInputChange}
                          onBlur={(e) => handleBlur(e, "Date de naissance")}
                          type="date"
                          required
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>
                    </div>

                    <div className="mt-1">
                      <label className="block text-sm font-medium text-ui-gray-dark">
                        Numéro de téléphone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="text"
                        value={user.phone}
                        required
                        placeholder="+243 820 000 000"
                        onChange={handleInputChange}
                        onBlur={(e) => handleBlur(e, "Téléphone")}
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
                        value={user.whatsapp}
                        placeholder="+243 810 000 000"
                        onChange={handleInputChange}
                        onBlur={(e) => handleBlur(e, "Whatsapp")}
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
                          value={address ? address.line1 : ""}
                          placeholder="N° 63, Ave Colonel Mondjiba, Q. Basoko"
                          onChange={handleInputChange}
                          onBlur={(e) => handleBlur(e, "Adresse")}
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>

                      <div className="mt-1">
                        <input
                          id="line2"
                          name="line2"
                          type="text"
                          value={address ? address.line2 : ""}
                          onChange={handleInputChange}
                          onBlur={(e) => handleBlur(e, "une référence d'adresse")}
                          placeholder="Réf. Silikin Village, Concession COTEX"
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>

                      <div className="mt-1">
                        <input
                          id="commune"
                          name="commune"
                          type="text"
                          value={address ? address.commune : ""}
                          required
                          placeholder="Commune ou Territoire"
                          onChange={handleInputChange}
                          onBlur={(e) => handleBlur(e, "Commune")}
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>

                      <div className="mt-1">
                        <input
                          id="ville"
                          name="ville"
                          type="text"
                          value={address ? address.ville : ""}
                          required
                          placeholder="Ville"
                          onChange={handleInputChange}
                          onBlur={(e) => handleBlur(e, "Ville")}
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>

                      <div className="mt-1">
                        <select
                          name="province"
                          id="province"
                          value={address ? address.province : "Votre province"}
                          onChange={handleInputChange}
                          onBlur={(e) => handleBlur(e, "Province")}
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        >
                          <option disabled selected hidden>
                            Votre province
                          </option>
                          {Object.keys(DRCProvinces).map((province, key) => (
                            <option key={key} value={province}>
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
