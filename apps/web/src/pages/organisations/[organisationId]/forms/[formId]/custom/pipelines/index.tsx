import PipelinesPage from "@/components/forms/pipelines/PipelinesOverview";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperCustomForm from "@/components/layout/LayoutWrapperCustomForm";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function Pipeline({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <LayoutWrapperCustomForm>
          <div className="p-5">
            <PipelinesPage />
          </div>
        </LayoutWrapperCustomForm>
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
