import LayoutBasic from "../../components/layout/LayoutBasic";
import FormList from "../../components/FormList";
import Head from "next/head";
import { useForms } from "../../lib/forms";
import Loading from "../../components/Loading";

export default function Forms({}) {
  const { isLoadingForms } = useForms();

  if (isLoadingForms) {
    <Loading />;
  }
  return (
    <>
      <Head>
        <title>Your forms - snoopForms</title>
      </Head>
      <LayoutBasic>
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="px-4 py-8 sm:px-0">
            <FormList />
          </div>
        </div>
      </LayoutBasic>
    </>
  );
}
