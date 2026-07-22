import { RunJsonCode } from "./run-json-code";

interface RunJsonSectionProps {
  title: string;
  value: unknown;
}

// Pretty-printed JSON block (trigger payload / run data) in the standard run-detail section frame.
export const RunJsonSection = ({ title, value }: Readonly<RunJsonSectionProps>) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5">
    <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
    <RunJsonCode value={value} />
  </section>
);
