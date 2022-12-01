import { useMemo } from "react";

interface Props {
  submissions: any;
  schema: any;
  fieldName: string;
}

export function Table({ submissions, schema, fieldName }: Props) {
  const data = useMemo(() => {
    if (!submissions || !schema || Object.keys(schema).length === 0) {
      return [];
    }
    // check if fieldName in schema
    const schemaElem = schema.children.find((e: any) => e.name === fieldName);
    if (typeof schemaElem === "undefined") {
      throw Error("key not found in schema");
    }
    const data = [];
    // scan submission for fieldName
    for (const submission of submissions) {
      if (
        fieldName in submission.data &&
        submission.data[fieldName] !== null &&
        typeof submission.data[fieldName] !== "undefined"
      ) {
        data.push(submission.data[fieldName]);
      }
    }
    return data;
  }, [submissions, schema]);
  return (
    <div className="my-4 mt-6 flow-root h-44 max-h-64 overflow-y-scroll px-8 text-center">
      <ul className="divide-ui-gray-light -my-5 divide-y">
        {data.map((answer) => (
          <li key={answer} className="py-4">
            <div className="relative focus-within:ring-2 focus-within:ring-slate-500">
              <h3 className="text-sm text-gray-700">
                <span className="absolute inset-0" aria-hidden="true" />
                {answer}
              </h3>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
