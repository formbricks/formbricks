import FormList from "../../components/FormList";
import BaseLayoutManagement from "../../components/layout/BaseLayoutManagement";
import LimitedWidth from "../../components/layout/LimitedWidth";
import withAuthentication from "../../components/layout/WithAuthentication";
import Loading from "../../components/Loading";
import { useForms } from "../../lib/forms";

function FormsPage({}) {
  const { isLoadingForms } = useForms();

  if (isLoadingForms) {
    <Loading />;
  }
  return (
    <BaseLayoutManagement
      title={"Forms - snoopForms"}
      breadcrumbs={[{ name: "My Forms", href: "#", current: true }]}
    >
      <LimitedWidth>
        <FormList />
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

export default withAuthentication(FormsPage);
