import Image from "next/image";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";
import { resendVerificationEmail } from "../../lib/users";

interface props {
  csrfToken: string;
}

export default function SignIn({}: props) {
  const router = useRouter();
  const email = router.query.email;

  const requestVerificationEmail = async () => {
    try {
      await resendVerificationEmail(email);
      toast("Verification email successfully sent. Please check your inbox.");
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    }
  };
  return (
    <BaseLayoutUnauthorized title="Verify your email">
      <div className="bg-ui-gray-light flex min-h-screen">
        <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="shadow-cont mx-auto w-full max-w-sm rounded-xl bg-white p-8 lg:w-96">
            <div>
              <Image src="/img/snoopforms-logo.svg" alt="snoopForms logo" width={500} height={89} />
            </div>

            <div className="mt-8">
              {email ? (
                <>
                  <h1 className="leading-2 mb-4 text-center font-bold">Please verify your email address</h1>
                  <p className="text-center">
                    We have sent you an email to the address{" "}
                    <span className="italic">{router.query.email}</span>. Please click the link in the email
                    to activate your account.
                  </p>
                  <hr className="my-4" />
                  <p className="text-center text-xs">
                    You didn&apos;t receive an email or your link expired?
                    <br />
                    Click the button below to request a new email.
                  </p>
                  <button
                    type="button"
                    onClick={() => requestVerificationEmail()}
                    className="mt-5 flex w-full justify-center rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                    Request a new verification mail
                  </button>{" "}
                </>
              ) : (
                <p className="text-center">No E-Mail Address provided</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </BaseLayoutUnauthorized>
  );
}
