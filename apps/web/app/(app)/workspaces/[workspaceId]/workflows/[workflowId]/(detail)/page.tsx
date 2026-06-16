import { placeholderWorkflowAction } from "@/modules/workflows/lib/placeholder-data";
import { WorkflowBuilderPage } from "@/modules/workflows/pages/workflow-builder-page";

const WorkflowPage = () => {
  return <WorkflowBuilderPage action={placeholderWorkflowAction} />;
};

export default WorkflowPage;
