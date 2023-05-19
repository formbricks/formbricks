import Image from "next/image";
import BaseLayoutUnauthorized from "../components/layout/BaseLayoutUnauthorized";
import Link from "next/link";

export default function Error404Page() {
  return (
    <BaseLayoutUnauthorized title="Page not found">
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto lg:w-96">
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
                Cette page n&apos;existe pas !
              </h1>
              <p className="text-center">
                Désolé, la page que vous cherchiez n&apos;a pas pu être trouvée.
                Veuillez vérifier que l&apos;URL est correcte ou{" "}
                <span className="underline">
                  <Link href="/">retourner à la page d&apos;accueil</Link>
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
