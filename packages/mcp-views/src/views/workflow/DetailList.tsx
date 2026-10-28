import type { Detail } from "./describe";

/** Label/value facts about a step or run. Values are untrusted text and render as text only. */
export const DetailList = ({ details }: Readonly<{ details: Detail[] }>) =>
  details.length === 0 ? null : (
    <dl className="wf-details">
      {details.map((detail) => (
        <div key={detail.label} className="wf-detail">
          <dt>{detail.label}</dt>
          <dd>{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
