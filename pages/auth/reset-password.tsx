import { XCircleIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";
import { resetPassword } from "../../lib/users";

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = router.query.token?.toString();
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await resetPassword(token, e.target.elements.password.value);

      router.push("/auth/reset-password-success");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <BaseLayoutUnauthorized title="Réinitialisation du mot de passe">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          {error && (
            <div className="absolute p-4 rounded-md top-10 bg-red-50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircleIcon
                    className="w-5 h-5 text-red-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Une erreur s&apos;est produite lors de la réinitialisation
                    de votre mot de passe{" "}
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p className="space-y-1 whitespace-pre-wrap">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <div>
              <div className="w-fit m-auto">
                <Image
                  src="/img/kadea_logo.png"
                  alt="Kadea  academy logo"
                  width={180}
                  height={40}
                />
              </div>

              <div className="mt-8">
                <div className="mt-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-ui-gray-dark"
                      >
                        Nouveau mot de passe
                      </label>
                      <div className="mt-1">
                        <input
                          id="password"
                          name="password"
                          type="password"
                          required
                          className="block w-full px-3 py-2 border rounded-md shadow-sm appearance-none placeholder-ui-gray-medium border-ui-gray-medium focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ph-no-capture"
                        />
                      </div>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm bg-red hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Réinitialiser le mot de passe
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
