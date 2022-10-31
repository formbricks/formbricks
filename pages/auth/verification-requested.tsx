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
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto bg-white rounded-xl shadow-cont lg:w-96">
            <div className="w-fit m-auto">
              <Image
                src="/img/kda_logo.png"
                alt="kinshasa digital academy logo"
                width={180}
                height={60}
              />
            </div>

            <div className="mt-8">
              {email ? (
                <>
                  <h1 className="mb-4 font-bold text-center leading-2">
                    Please verify your email address
                  </h1>
                  <p className="text-center">
                    We have sent you an email to the address{" "}
                    <span className="italic">{router.query.email}</span>. Please
                    click the link in the email to activate your account.
                  </p>
                  <hr className="my-4" />
                  <p className="text-xs text-center">
                    You didn&apos;t receive an email or your link expired?
                    <br />
                    Click the button below to request a new email.
                  </p>
                  <button
                    type="button"
                    onClick={() => requestVerificationEmail()}
                    className="flex justify-center w-full px-4 py-2 mt-5 text-sm font-medium text-gray-600 bg-white border border-gray-400 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
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
