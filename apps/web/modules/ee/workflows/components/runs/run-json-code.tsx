"use client";

import { useMemo } from "react";
import { stringifyRunJson } from "@/modules/ee/workflows/lib/run-display";
import { CodeBlock } from "@/modules/ui/components/code-block";

interface RunJsonCodeProps {
  value: unknown;
}

// Memoized, size-bounded JSON block for run payloads. Stringifying once per `value` (not per
// render) keeps the string reference stable, so CodeBlock's `Prism.highlightAll()` effect doesn't
// re-run on unrelated re-renders; `stringifyRunJson` caps the length so an unbounded run payload
// can't produce a multi-MB DOM node.
export const RunJsonCode = ({ value }: Readonly<RunJsonCodeProps>) => {
  const json = useMemo(() => stringifyRunJson(value), [value]);

  return (
    <CodeBlock language="json" noMargin>
      {json}
    </CodeBlock>
  );
};
