import FormList from "../../components/FormList";
import BaseLayoutManagement from "../../components/layout/BaseLayoutManagement";
import LimitedWidth from "../../components/layout/LimitedWidth";
import withAuthentication from "../../components/layout/WithAuthentication";
import Loading from "../../components/Loading";
import { useSourcings } from "../../lib/sourcings";

function SourcingsPage({}) {
  const { isLoadingSourcings } = useSourcings();

  if (isLoadingSourcings) {
    <Loading />;
  }
  return (
    <BaseLayoutManagement
      title={"Sourcings - snoopForms"}
      breadcrumbs={[{ name: "Sourcings", href: "#", current: true }]}
    >
      <LimitedWidth>
        <FormList />
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

export default withAuthentication(SourcingsPage);
