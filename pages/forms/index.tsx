import FormList from "../../components/FormList";
import BaseLayoutAuthorized from "../../components/layout/BaseLayoutAuthorized";
import LimitedWidth from "../../components/layout/LimitedWidth";
import Loading from "../../components/Loading";
import { useForms } from "../../lib/forms";

export default function Forms({}) {
  const { isLoadingForms } = useForms();

  if (isLoadingForms) {
    <Loading />;
  }
  return (
    <>
      <BaseLayoutAuthorized
        title={"Forms - snoopForms"}
        breadcrumbs={[{ name: "My Forms", href: "#", current: true }]}
      >
        <LimitedWidth>
          <FormList />
        </LimitedWidth>
      </BaseLayoutAuthorized>
    </>
  );
}
