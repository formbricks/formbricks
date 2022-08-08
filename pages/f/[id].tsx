import App from "../../components/frontend/App";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";
import Loading from "../../components/Loading";
import MessagePage from "../../components/MessagePage";
import { useNoCodeFormPublic } from "../../lib/noCodeForm";
import { useRouter } from "next/router";

export default function Share({}) {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { noCodeForm, isLoadingNoCodeForm, isErrorNoCodeForm } =
    useNoCodeFormPublic(formId);

  if (isErrorNoCodeForm) {
    return (
      <MessagePage text="Form not found. Are you sure this is the right URL?" />
    );
  }

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  return (
    <BaseLayoutUnauthorized title="snoopForms">
      <App formId={formId} blocks={noCodeForm.blocks} />
    </BaseLayoutUnauthorized>
  );
}
