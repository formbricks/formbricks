import App from "../../components/frontend/App";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";
import Loading from "../../components/Loading";
import MessagePage from "../../components/MessagePage";
import { useNoCodeFormPublic } from "../../lib/noCodeForm";
import { useRouter } from "next/router";
import Image from "next/legacy/image";

function NoCodeFormPublic() {
  const router = useRouter();
  const formId = router.query.id?.toString();
  const { noCodeForm, isLoadingNoCodeForm, isErrorNoCodeForm } = useNoCodeFormPublic(formId);

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  if (isErrorNoCodeForm || !noCodeForm?.published) {
    return <MessagePage text="Form not found. Are you sure this is the right URL?" />;
  }

  return (
    <BaseLayoutUnauthorized title="snoopForms">
      <div className="flex h-screen flex-col justify-between bg-white">
        {noCodeForm.closed ? (
          <div className="bg-ui-gray-light flex min-h-screen">
            <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
              <div className="mx-auto w-full max-w-sm p-8 lg:w-96">
                <div>
                  <Image src="/img/snoopforms-logo.svg" alt="snoopForms logo" width={500} height={89} />
                </div>
                <div className="mt-8">
                  <h1 className="leading-2 mb-4 text-center font-bold">Form closed!</h1>
                  <p className="text-center">This form is closed for any further submissions.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <App formId={formId} blocks={noCodeForm.blocks} />
        )}
        {(process.env.NEXT_PUBLIC_PRIVACY_URL || process.env.NEXT_PUBLIC_IMPRINT_URL) && (
          <footer className="flex h-10 w-full items-center justify-center text-xs text-gray-300">
            {process.env.NEXT_PUBLIC_IMPRINT_URL && (
              <>
                <a href={process.env.NEXT_PUBLIC_IMPRINT_URL} target="_blank" rel="noreferrer">
                  Imprint
                </a>
              </>
            )}
            {process.env.NEXT_PUBLIC_IMPRINT_URL && process.env.NEXT_PUBLIC_PRIVACY_URL && (
              <span className="px-2">|</span>
            )}
            {process.env.NEXT_PUBLIC_PRIVACY_URL && (
              <a href={process.env.NEXT_PUBLIC_PRIVACY_URL} target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
            )}
          </footer>
        )}
      </div>
    </BaseLayoutUnauthorized>
  );
}

export default NoCodeFormPublic;
