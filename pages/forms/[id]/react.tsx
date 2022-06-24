import { DocumentSearchIcon, TerminalIcon } from "@heroicons/react/outline";
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { FaDiscord, FaReact, FaVuejs } from "react-icons/fa";
import LayoutFormBasics from "../../../components/layout/LayoutFormBasic";
import SecondNavBar from "../../../components/layout/SecondNavBar";
import SecondNavBarItem from "../../../components/layout/SecondNavBarItem";
import Loading from "../../../components/Loading";
import { useForm } from "../../../lib/forms";

export default function ReactPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <>
      <LayoutFormBasics
        title={form.title}
        formId={formId}
        currentStep="pipelines"
      >
        <SecondNavBar>
          <SecondNavBarItem link href={`/forms/${formId}/form`}>
            <TerminalIcon className="w-8 h-8 mx-auto stroke-1" />
            formID
          </SecondNavBarItem>
          <SecondNavBarItem link href={`/forms/${formId}/react`}>
            <FaReact className="w-8 h-8 mx-auto stroke-1" />
            React
          </SecondNavBarItem>
          <SecondNavBarItem disabled>
            <FaReact className="w-8 h-8 mx-auto stroke-1" />
            React Native
          </SecondNavBarItem>
          <SecondNavBarItem disabled>
            <FaVuejs className="w-8 h-8 mx-auto stroke-1" />
            Vue
          </SecondNavBarItem>
          <SecondNavBarItem link outbound href="https://docs.snoopforms.com">
            <DocumentSearchIcon className="w-8 h-8 mx-auto stroke-1" />
            Docs
          </SecondNavBarItem>
        </SecondNavBar>
        <header>
          <div className="mx-auto mt-8 max-w-7xl">
            <h1 className="text-3xl font-bold leading-tight text-ui-gray-dark">
              Build your form with React
            </h1>
          </div>
        </header>
        <div className="my-4">
          <p className="text-ui-gray-dark">
            Use our pre-built components to build your form. Manage data in this
            dashboard.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 mt-16">
          <div>
            <h2 className="text-xl font-bold text-ui-gray-dark">
              1. Get started
            </h2>
            <p className="text-ui-gray-dark">
              Install the snoopReact Library with Node Package Manager via
              snoopforms/react.
            </p>
          </div>
          <div className="p-8 font-light text-gray-200 bg-black rounded-md">
            <code>{"npm install --save @snoopforms/react"}</code>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-10 mt-16">
          <div>
            <h2 className="text-xl font-bold text-ui-gray-dark">
              2. Build the form
            </h2>
            <p className="text-ui-gray-dark">
              Use the pre-built components snoopForm, snoopPage and snoopElement
              to build exactly the form you want.
            </p>
          </div>
          <div className="p-8 font-light text-gray-200 bg-black rounded-md">
            <code className="whitespace-pre language-js">{`<SnoopForm
  domain="localhost:3000"
  protocol="http"
  className="w-full space-y-6"
  onSubmit={({ submission, schema })=>{}}>
     
     <SnoopPage name="first">
       <SnoopElement
         type="text"
         name={"name"}
         label="Your name"
         classNames={{
         label: "your-label-class",
         element: "your-input-class",}}
         required/>
      </SnoopPage>

      <SnoopPage thankyou>
        <h1>Thank you!</h1>
      </SnoopPage>
      
    </SnoopForm>`}</code>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-10 my-16">
          <div>
            <h2 className="text-xl font-bold text-ui-gray-dark">Questions?</h2>
            <p className="pb-4 text-ui-gray-dark">
              Find a more detailed explanation on how to go about build the form
              and piping your data{" "}
              <a
                href="https://docs.snoopforms.com"
                target="_blank"
                rel="noreferrer"
                className="underline text-red hover:no-underline"
              >
                in the docs.
              </a>{" "}
              Or join our Discord and ask us :)
            </p>
          </div>
          <div className="flex items-center justify-center p-8 rounded-md bg-purple">
            <a
              className="inline-flex items-center justify-center px-4 py-2 bg-white rounded-sm hover:motion-safe:animate-bounce text-purple text-bold text-md"
              href="https://discord.gg/kT4Aq7Kq"
              target="_blank"
              rel="noreferrer"
            >
              Join Discord <FaDiscord className="w-8 h-8 ml-2" />
            </a>
          </div>
        </div>
      </LayoutFormBasics>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;
  }
  return { props: {} };
};
