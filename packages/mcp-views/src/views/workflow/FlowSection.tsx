import { DetailList } from "./DetailList";
import type { ConditionTree } from "./describe";
import { type FlowBranch, type FlowModel, type FlowStep, getStepKindLabel } from "./flow";

const Condition = ({ tree }: Readonly<{ tree: ConditionTree }>) => {
  if (tree.kind === "condition") {
    return <li className="wf-condition">{tree.text}</li>;
  }
  return (
    <li className="wf-condition-group">
      <span className="fb-faint">
        {tree.connector === "or" ? "Any of these is true" : "All of these are true"}
      </span>
      <ul className="wf-conditions">
        {tree.children.map((child, index) => (
          <Condition key={index} tree={child} />
        ))}
      </ul>
    </li>
  );
};

const Branch = ({ branch }: Readonly<{ branch: FlowBranch }>) => (
  <li className="wf-branch">
    <p className="wf-branch-label">{branch.label}</p>
    {branch.steps.length === 0 ? (
      <p className="fb-faint">Nothing happens, the workflow ends here.</p>
    ) : (
      <Steps steps={branch.steps} />
    )}
  </li>
);

const Step = ({ step }: Readonly<{ step: FlowStep }>) => (
  <li className="wf-step">
    <div className={`wf-card wf-card-${step.kind}`}>
      <div className="fb-row wf-step-head">
        <span className="wf-kind">{getStepKindLabel(step)}</span>
        <h3 className="wf-step-title">{step.title}</h3>
        {step.kind === "action" && step.missing.length > 0 ? (
          <span className="fb-badge fb-badge-warning">Needs {step.missing.join(", ")}</span>
        ) : null}
      </div>
      <p className="wf-step-summary">{step.summary}</p>
      {step.kind === "trigger" || step.kind === "action" ? <DetailList details={step.details} /> : null}
      {step.kind === "condition" && step.condition ? (
        <ul className="wf-conditions wf-conditions-root">
          <Condition tree={step.condition} />
        </ul>
      ) : null}
    </div>
    {step.kind === "condition" ? (
      <ul className="wf-branches">
        {step.branches.map((branch) => (
          <Branch key={branch.label} branch={branch} />
        ))}
      </ul>
    ) : null}
  </li>
);

const Steps = ({ steps }: Readonly<{ steps: FlowStep[] }>) => (
  <ol className="wf-flow">
    {steps.map((step) => (
      <Step key={step.id} step={step} />
    ))}
  </ol>
);

export const FlowSection = ({ flow }: Readonly<{ flow: FlowModel }>) => (
  <section className="fb-stack" aria-labelledby="wf-flow-heading">
    <h2 id="wf-flow-heading" className="wf-section-title">
      How it works
    </h2>
    {flow.steps.length === 0 ? (
      <p className="fb-muted">This workflow has no trigger yet, so nothing starts it.</p>
    ) : (
      <Steps steps={flow.steps} />
    )}
    {flow.unconnected.length > 0 ? (
      <div className="fb-stack">
        <h3 className="wf-subsection-title">Not connected to the trigger</h3>
        <Steps steps={flow.unconnected} />
      </div>
    ) : null}
  </section>
);
