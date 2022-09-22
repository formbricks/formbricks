/* eslint-disable react-hooks/rules-of-hooks */
import BaseLayoutManagement from "../../../components/layout/BaseLayoutManagement";
import { ClockIcon } from "@heroicons/react/24/solid";
import withAuthentication from "../../../components/layout/WithAuthentication";
import Loading from "../../../components/Loading";
import MessagePage from "../../../components/MessagePage";
import { useNoCodeFormPublic } from "../../../lib/noCodeForm";
import {useForm} from "../../../lib/forms"
import { useRouter } from "next/router";
import Image from "next/image";
import getConfig from "next/config";
import usePages from "../../../hooks/usePages";
import LimitedWidth from "../../../components/layout/LimitedWidth";

const { publicRuntimeConfig } = getConfig();
const { publicPrivacyUrl, publicImprintUrl } = publicRuntimeConfig;

function NoCodeFormPublic() {
  const router = useRouter();
  const formId = router.query.id?.toString();
  const completed=false;
  const { noCodeForm, isLoadingNoCodeForm, isErrorNoCodeForm } =
    useNoCodeFormPublic(formId);
 // const {form, isLoadingForm, isErrorForm}= useForm(user)
    
  
  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pages = usePages({blocks:noCodeForm.blocks, formId:formId})
  console.log(noCodeForm.form.name);


  if (isErrorNoCodeForm || !noCodeForm?.published) {
    return (
      <MessagePage text="Form not found. Are you sure this is the right URL?" />
    );
  }

  const goToPage  = (pageId) => {
    console.log(pageId);
    router.push(`/sourcings/${formId}/${pageId}`)
    
  }
  return (
    <BaseLayoutManagement       
    title={"Forms - snoopForms"}
    breadcrumbs={[{ name: `My Sourcings / ${noCodeForm.form.name}`, href: "#", current: true }]}
    >
        <LimitedWidth>
      <div className="flex flex-col justify-between h-screen bg-white">
        {noCodeForm.closed ? (
          <div className="flex min-h-screen bg-ui-gray-light">
            <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
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
                    Form closed!
                  </h1>
                  <p className="text-center">
                    This form is closed for any further submissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-col" >
            <h1 className="text-2xl ml-12 mt-5 mx-auto font-bold" >{noCodeForm.form.name}</h1>
            <table className="auto mt-5 w-full">

                <tbody className="w-full text-xl">
                    {
                        pages.map((page, index)=>{
                           if(pages.length-1!==index) return (
                            <tr key={index} className="w-full py-4 border-y-2 border-slate-100 flex justify-between">
                               <td className="pl-12 flex items-center">{(page.length)?"":page.blocks[0].data.text}</td>
                               <td className="flex items-center justify-between w-1/3">
                                   <div className="flex items-center w-4/5">{page.blocks[1].type==="timerToolboxOption"?<span className="flex items-center"><ClockIcon className="w-10 mr-2"/>{page.blocks[1].data.timerDuration} minutes</span>:<></>}</div>
                                   <button onClick={() => goToPage(`${page.id}`)} disabled={completed} className="w-107 rounded-full bg-green-800 p-2.5 text-white font-bold">{completed?"Complete":"Start"}</button>
                               </td>
                            </tr>
                            )
                        })    
                    }      
                </tbody>
            </table>
          </div>
        )}
        {(publicPrivacyUrl || publicImprintUrl) && (
          <footer className="flex items-center justify-center w-full h-10 text-xs text-gray-300">
            {publicImprintUrl && (
              <>
                <a href={publicImprintUrl} target="_blank" rel="noreferrer">
                  Imprint
                </a>
              </>
            )}
            {publicImprintUrl && publicPrivacyUrl && (
              <span className="px-2">|</span>
            )}
            {publicPrivacyUrl && (
              <a href={publicPrivacyUrl} target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
            )}
          </footer>
        )}
      </div>
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

NoCodeFormPublic.getInitialProps = () => {
  return {};
};

export default withAuthentication(NoCodeFormPublic);
