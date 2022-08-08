import App from "../../../components/frontend/App";
import LayoutPreview from "../../../components/layout/LayoutPreview";
import Loading from "../../../components/Loading";
import MessagePage from "../../../components/MessagePage";
import { toast } from "react-toastify";
import { useForm } from "../../../lib/forms";
import { useNoCodeForm } from "../../../lib/noCodeForm";
import { useRouter } from "next/router";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import withAuthentication from "../../../components/layout/WithAuthentication";

function SharePage({}) {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm, isErrorForm } = useForm(formId);
  const [appId, setAppId] = useState(uuidv4());

  const { noCodeForm, isLoadingNoCodeForm } = useNoCodeForm(formId);

  const resetApp = () => {
    setAppId(uuidv4());
    toast("Form resetted 👌");
  };

  if (isLoadingForm || isLoadingNoCodeForm) {
    return <Loading />;
  }

  if (isErrorForm) {
    return (
      <MessagePage text="Unable to load this page. Maybe you don't have enough rights." />
    );
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

export default withAuthentication(SharePage);
