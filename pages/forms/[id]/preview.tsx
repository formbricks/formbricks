import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import App from "../../../components/frontend/App";
import LayoutPreview from "../../../components/layout/LayoutPreview";
import Loading from "../../../components/Loading";
import { useForm } from "../../../lib/forms";
import { useNoCodeForm } from "../../../lib/noCodeForm";

export default function Share({}) {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(formId);
  const [appId, setAppId] = useState(uuidv4());

  const { noCodeForm, isLoadingNoCodeForm } = useNoCodeForm(formId);

  const resetApp = () => {
    setAppId(uuidv4());
    toast("Form resetted 👌");
  };

  if (isLoadingForm || isLoadingNoCodeForm) {
    return <Loading />;
  }

  if (form.formType !== "NOCODE") {
    return (
      <div>Preview is only avaiblable for Forms built with No-Code-Editor</div>
    );
  }

  return (
    <LayoutPreview formId={formId} resetApp={resetApp}>
      <App
        id={appId}
        blocks={noCodeForm.blocksDraft}
        localOnly={true}
        formId={formId}
      />
    </LayoutPreview>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;
  }
  return { props: {} };
};
