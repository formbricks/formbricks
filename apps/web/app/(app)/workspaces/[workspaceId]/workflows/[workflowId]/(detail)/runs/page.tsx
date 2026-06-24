import { WorkflowRunsPage } from "@/modules/workflows/pages/workflow-runs-page";

// Real runs API client lands with ENG-1226 — until then the runs tab renders the empty state.
const WorkflowRuns = async () => <WorkflowRunsPage runs={[]} />;

export default WorkflowRuns;
