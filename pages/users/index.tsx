// import FormList from "../../components/FormList";
import UserList from "../../components/UserList";
import BaseLayoutManagement from "../../components/layout/BaseLayoutManagement";
import LimitedWidth from "../../components/layout/LimitedWidth";
import withAuthentication from "../../components/layout/WithAuthentication";
import Loading from "../../components/Loading";
import { useForms } from "../../lib/forms";

function UsersPage({}) {
  const { isLoadingForms } = useForms();

  if (isLoadingForms) {
    <Loading />;
  }
  return (
    <BaseLayoutManagement
      title={"Sourcings - Kadea "}
      breadcrumbs={[
        { name: "Gestion des utilisateurs", href: "#", current: true },
      ]}
      activeMenu='users'
    >
      <LimitedWidth>
        <UserList />
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

export default withAuthentication(UsersPage);
