import Image from "next/image";
import BaseLayoutUnauthorized from "../components/layout/BaseLayoutUnauthorized";
import Link from "next/link";

export default function Error404Page() {
    return (
        <BaseLayoutUnauthorized title="Page not found">
            <div className="flex min-h-screen bg-ui-gray-light">
                <div
                    className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                    <div className="w-full max-w-sm p-8 mx-auto lg:w-96">
                        <div>
                            <Image
                                src="/img/snoopforms-logo.svg"
                                alt="snoopForms logo"
                                width={500}
                                height={89}
                            />
                        </div>
                        <div className="mt-8">
                            <h1 className="mb-4 font-bold text-center leading-2">
                                This page does not exist!
                            </h1>
                            <p className="text-center">
                                Sorry, the page you were looking for could not be found.
                                Please make sure the URL is correct or <span className="underline"><Link href="/">go back to the homepage</Link></span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </BaseLayoutUnauthorized>
    );
}
