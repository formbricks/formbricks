import FormOverviewPage from "@/components/forms/custom/FormOverviewPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperCustomForm";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function FormOverview({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <LayoutWrapperForm>
          <FormOverviewPage />
        </LayoutWrapperForm>
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
