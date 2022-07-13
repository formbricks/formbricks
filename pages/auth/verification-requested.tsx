import Image from "next/image";
import { useRouter } from "next/router";

interface props {
  csrfToken: string;
}

export default function SignIn({}: props) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen bg-ui-gray-light">
      <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
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
              Please verify your email address
            </h1>
            <p className="text-center">
              We have sent you an email to the address{" "}
              <span className="italic">{router.query.email}</span>. Please click
              the link in the email to activate your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
