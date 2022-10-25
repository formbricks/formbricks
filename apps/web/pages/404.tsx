import Image from "next/legacy/image";
import BaseLayoutUnauthorized from "../components/layout/BaseLayoutUnauthorized";
import Link from "next/link";

export default function Error404Page() {
  return (
    <BaseLayoutUnauthorized title="Page not found">
      <div className="bg-ui-gray-light flex min-h-screen">
        <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm p-8 lg:w-96">
            <div>
              <Image src="/img/snoopforms-logo.svg" alt="snoopForms logo" width={500} height={89} />
            </div>
            <div className="mt-8">
              <h1 className="leading-2 mb-4 text-center font-bold">This page does not exist!</h1>
              <p className="text-center">
                Sorry, the page you were looking for could not be found. Please make sure the URL is correct
                or{" "}
                <span className="underline">
                  <Link href="/">go back to the homepage</Link>
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
