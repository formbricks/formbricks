import hljs from "highlight.js";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { FaDiscord } from "react-icons/fa";
import BaseLayoutManagement from "../../../../components/layout/BaseLayoutManagement";
import LimitedWidth from "../../../../components/layout/LimitedWidth";
import SecondNavBar from "../../../../components/layout/SecondNavBar";
import withAuthentication from "../../../../components/layout/WithAuthentication";
import Loading from "../../../../components/Loading";
import MessagePage from "../../../../components/MessagePage";
import { useForm } from "../../../../lib/forms";
import { useCodeSecondNavigation } from "../../../../lib/navigation/formCodeSecondNavigation";
import { useFormMenuSteps } from "../../../../lib/navigation/formMenuSteps";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("bash", bash);

function ReactPage() {
  useEffect(() => {
    hljs.initHighlighting();
  }, []);

  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm, isErrorForm } = useForm(formId);
  const codeSecondNavigation = useCodeSecondNavigation(formId);
  const formMenuSteps = useFormMenuSteps(formId);

  if (isLoadingForm) {
    return <Loading />;
  }

  if (isErrorForm) {
    return <MessagePage text="Unable to load this page. Maybe you don't have enough rights." />;
  }

  return (
    <>
      <BaseLayoutManagement
        title={form.name}
        breadcrumbs={[{ name: form.name, href: "#", current: true }]}
        steps={formMenuSteps}
        currentStep="form">
        <SecondNavBar navItems={codeSecondNavigation} currentItemId="react" />
        <LimitedWidth>
          <header>
            <div className="mx-auto mt-8 max-w-7xl">
              <h1 className="text-ui-gray-dark text-3xl font-bold leading-tight">
                Build your form with React
              </h1>
            </div>
          </header>
          <div className="my-4">
            <p className="text-ui-gray-dark">
              Use our pre-built components to build your form. Manage data in this dashboard.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-10">
            <div>
              <h2 className="text-ui-gray-dark text-xl font-bold">1. Get started</h2>
              <p className="text-ui-gray-dark">
                Install the snoopReact Library with Node Package Manager via snoopforms/react.
              </p>
            </div>
            <div className="rounded-md bg-[#1a1b26] p-8 font-light text-gray-200">
              <pre>
                <code className="bash">npm install --save @snoopforms/react</code>
              </pre>
            </div>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-10">
            <div>
              <h2 className="text-ui-gray-dark text-xl font-bold">2. Build the form</h2>
              <p className="text-ui-gray-dark">
                Use the pre-built components snoopForm, snoopPage and snoopElement to build exactly the form
                you want.
              </p>
            </div>
            <div className="rounded-md bg-[#1a1b26] p-8 font-light text-gray-200">
              <pre>
                <code className="javascript">
                  {`import {
  SnoopForm,
  SnoopPage,
  SnoopElement
} from "@snoopforms/react";
import "@snoopforms/react/dist/styles.css";

...
                  
<SnoopForm
  domain="${window?.location.host}"
  protocol="${window?.location.protocol.replace(":", "")}">
     
     <SnoopPage name="first">
       <SnoopElement
         type="text"
         name={"name"}
         label="Your name"
         required/>
      </SnoopPage>

      <SnoopElement
      type="checkboxes"
      label="Tools you love"
      options={[
        "TailwindCSS",
        "React",
        "snoopForms" ]}
    />

      <SnoopPage thankyou>
        <h1>Thank you!</h1>
      </SnoopPage>
      
    </SnoopForm>`}
                </code>
              </pre>
            </div>
          </div>
          <div className="my-16 grid grid-cols-2 gap-10">
            <div>
              <h2 className="text-ui-gray-dark text-xl font-bold">Questions?</h2>
              <p className="text-ui-gray-dark pb-4">
                Find a more detailed explanation on how to go about build the form and piping your data{" "}
                <a
                  href="https://docs.snoopforms.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-red underline hover:no-underline">
                  in the docs.
                </a>{" "}
                Or join our Discord and ask us :)
              </p>
            </div>
            <div className="bg-purple flex items-center justify-center rounded-md p-8">
              <a
                className="text-purple text-bold text-md inline-flex items-center justify-center rounded-sm bg-white px-4 py-2 hover:motion-safe:animate-bounce"
                href="https://discord.gg/3YFcABF2Ts"
                target="_blank"
                rel="noreferrer">
                Join Discord <FaDiscord className="ml-2 h-8 w-8" />
              </a>
            </div>
          </div>
        </LimitedWidth>
      </BaseLayoutManagement>
    </>
  );
}

export default withAuthentication(ReactPage);
