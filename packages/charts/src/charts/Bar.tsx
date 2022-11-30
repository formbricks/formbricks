import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Label, Legend, Tooltip, XAxis, YAxis } from "recharts";
/* const data = [
  {
    name: "Page A",
    value: 4000,
  },
  {
    name: "Page B",
    value: 3000,
  },
  {
    name: "Page C",
    value: 2000,
  },
  {
    name: "Page D",
    value: 2780,
  },
]; */

interface Props {
  color?: string;
  submissions: any;
  schema: any;
  show: string;
}

export function FbBar({ color, submissions, schema, show }: Props) {
  const data = useMemo(() => {
    const dataDict: any = {};
    const schemaElem = schema.children.find((e: any) => e.name === show);
    if (typeof schemaElem === "undefined") {
      throw Error("key not found in schema");
    }
    for (const option of schemaElem.options) {
      dataDict[option.value] = { name: option.label, value: 0 };
    }
    for (const submission of submissions) {
      if (show in submission.data) {
        // if submission value is array (checkboxes)
        if (Array.isArray(submission.data[show])) {
          for (const value of submission.data[show]) {
            if (value in dataDict) {
              dataDict[value] = {
                ...dataDict[value],
                value: dataDict[value].value + 1,
              };
            }
          }
        }
        // if submission value is string (radio buttons)
        else if (typeof submission.data[show] == "string") {
          if (submission.data[show] in dataDict) {
            dataDict[submission.data[show]] = {
              ...dataDict[submission.data[show]],
              value: dataDict[submission.data[show]].value + 1,
            };
          }
        }
      }
    }
    // transform dataDict to desired form
    const data = [];
    for (const [key, value] of Object.entries(dataDict)) {
      data.push(value);
    }
    return data;
  }, [submissions]);

  return (
    <>
      <BarChart width={730} height={250} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis label={{ value: "# answers", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill={color || "#00C4B8"} />
      </BarChart>
    </>
  );
}

export { FbBar as Bar };
