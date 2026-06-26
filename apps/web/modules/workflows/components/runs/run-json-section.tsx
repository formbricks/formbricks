import { CodeBlock } from "@/modules/ui/components/code-block";

interface RunJsonSectionProps {
  title: string;
  value: unknown;
}

// Pretty-printed JSON block (trigger payload / run data) in the standard run-detail section frame.
export const RunJsonSection = ({ title, value }: Readonly<RunJsonSectionProps>) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5">
    <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
    <CodeBlock language="json" noMargin>
      {JSON.stringify(value, null, 2)}
    </CodeBlock>
  </section>
);
