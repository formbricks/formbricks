import FormOverviewPage from "@/components/forms/custom/FormOverviewPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperCustomForm";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function FormOverview({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <LayoutWrapperForm>
          <FormOverviewPage />
        </LayoutWrapperForm>
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
