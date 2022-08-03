import { useRouter } from "next/router";
import App from "../../components/frontend/App";
import BaseLayoutUnauthorized from "../../components/layout/BaseLayoutUnauthorized";
import Loading from "../../components/Loading";
import { useNoCodeFormPublic } from "../../lib/noCodeForm";

export default function Share({}) {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { noCodeForm, isLoadingNoCodeForm, isErrorNoCodeForm } =
    useNoCodeFormPublic(formId);

  if (isErrorNoCodeForm) {
    return <p>Not found</p>;
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
