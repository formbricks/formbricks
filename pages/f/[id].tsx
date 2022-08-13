import App from "../../components/frontend/App";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";
import Loading from "../../components/Loading";
import MessagePage from "../../components/MessagePage";
import { useNoCodeFormPublic } from "../../lib/noCodeForm";
import { useRouter } from "next/router";
import Image from "next/image";

export default function NoCodeFormPublic() {
    const router = useRouter();
    const formId = router.query.id.toString();
    const {noCodeForm, isLoadingNoCodeForm, isErrorNoCodeForm} =
        useNoCodeFormPublic(formId);

    if (isErrorNoCodeForm) {
        return (
            <MessagePage text="Form not found. Are you sure this is the right URL?"/>
        );
    }

    if (isLoadingNoCodeForm) {
        return <Loading/>;
    }

    return (
        <BaseLayoutUnauthorized title="snoopForms">
            {noCodeForm.published ? (
                <App formId={formId} blocks={noCodeForm.blocks}/>
            ) : (
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
                          Form unavailable!
                        </h1>
                        <p className="text-center">
                          This form is not available anymore.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
            )}
        </BaseLayoutUnauthorized>
    );
}
