import { WorkspaceWorkflowRunsPage } from "@/modules/workflows/pages/workspace-workflow-runs-page";

// Real runs API client lands with ENG-1226 — until then the runs tab renders the empty state.
const WorkflowRunsPage = () => <WorkspaceWorkflowRunsPage runs={[]} />;

export default WorkflowRunsPage;
