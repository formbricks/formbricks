import Image from "next/image";
import { useRouter } from "next/router";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";

export default function SignupWithoutVerificationSuccess() {
    const router = useRouter();

    return (
        <BaseLayoutUnauthorized title="Verify your email">
            <div className="flex min-h-screen bg-ui-gray-light">
                <div
                    className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                    <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
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
                                User successfully created
                            </h1>
                            <p className="text-center">
                                Your new user has been created successfully. Please
                                click the button below and sign in to your account.
                            </p>
                            <hr className="my-4"/>
                            <button
                                type="button"
                                onClick={() => router.push(
                                    '/'
                                )}
                                className="flex justify-center w-full px-4 py-2 mt-5 text-sm font-medium text-gray-600 bg-white border border-gray-400 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </BaseLayoutUnauthorized>
    );
}
