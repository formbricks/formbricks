import PipelinesPage from "@/components/forms/pipelines/PipelinesOverview";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperForm";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function Pipeline({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <LayoutWrapperForm>
          <PipelinesPage />
        </LayoutWrapperForm>
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
