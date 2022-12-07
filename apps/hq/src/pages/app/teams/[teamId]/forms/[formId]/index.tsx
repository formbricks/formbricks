import FormOverviewPage from "@/components/forms/FormOverviewPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperForm";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function FormOverview({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <LayoutWrapperForm>
          <FormOverviewPage />
        </LayoutWrapperForm>
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
