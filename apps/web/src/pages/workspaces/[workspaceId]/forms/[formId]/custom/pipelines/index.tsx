import PipelinesPage from "@/components/forms/pipelines/PipelinesOverview";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperCustomForm from "@/components/layout/LayoutWrapperCustomForm";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function Pipeline({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <LayoutWrapperCustomForm>
          <div className="p-5">
            <PipelinesPage />
          </div>
        </LayoutWrapperCustomForm>
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
