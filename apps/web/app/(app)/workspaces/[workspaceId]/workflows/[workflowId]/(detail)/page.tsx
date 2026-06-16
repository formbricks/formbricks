import { placeholderWorkflowActionNode } from "@/modules/workflows/lib/placeholder-data";
import { WorkflowBuilderPage } from "@/modules/workflows/pages/workflow-builder-page";

const WorkflowPage = () => {
  return <WorkflowBuilderPage action={placeholderWorkflowActionNode} />;
};

export default WorkflowPage;
