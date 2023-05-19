import Image from "next/image";
import { useRouter } from "next/router";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function SignupWithoutVerificationSuccess() {
  const router = useRouter();

  return (
    <BaseLayoutUnauthorized title="Vérifie ton adresse e-mail">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <div className="w-fit m-auto">
              <Image
                src="/img/kadea_logo.png"
                alt="Kadea  academy logo"
                width={180}
                height={40}
              />
            </div>

            <div className="mt-8">
              <h1 className="mb-4 font-bold text-center leading-2">
                Compte utilisateur créé
              </h1>
              <p className="text-center">
                Ton nouveau compte utilisateur a été créé avec succès. Clique
                sur le bouton ci-dessous pour te connecter à ton compte.
              </p>
              <hr className="my-4" />
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex justify-center w-full px-4 py-2 mt-5 text-sm font-medium text-gray-600 bg-white border border-gray-400 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Connexion
              </button>
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
