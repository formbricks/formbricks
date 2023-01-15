import PipelinesPage from "@/components/forms/pipelines/PipelinesOverview";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperForm from "@/components/layout/LayoutWrapperForm";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function Pipeline({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <LayoutWrapperForm>
          <PipelinesPage />
        </LayoutWrapperForm>
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
