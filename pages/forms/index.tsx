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
      title={"Sourcings - Kadea Sourcing"}
      breadcrumbs={[{ name: "Sourcings", href: "#", current: true }, { name: "Gestion des utilisateurs", href: "/users", current: false }]}
      activeMenu='forms'
    >
      <LimitedWidth>
        <FormList />
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

export default withAuthentication(FormsPage);
