import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  color?: string;
  submissions: any;
  schema: any;
  fieldName: string;
}

export function Nps({ color, submissions, schema, fieldName }: Props) {
  const data = useMemo(() => {
    if (!fieldName) {
      throw Error("no field name provided");
    }
    if (!submissions || !schema || Object.keys(schema).length === 0) {
      return [];
    }
    // build data object by finding schema definition of field and scanning submissions for this key
    const dataDict: any = {};
    const schemaElem = schema.children.find((e: any) => e.name === fieldName);
    if (typeof schemaElem === "undefined") {
      throw Error("key not found in schema");
    }
    for (const option of [...Array(11).keys()]) {
      dataDict[option] = { name: option, value: 0 };
    }
    for (const submission of submissions) {
      if (fieldName in submission.data) {
        if (submission.data[fieldName] in dataDict) {
          dataDict[submission.data[fieldName]] = {
            ...dataDict[submission.data[fieldName]],
            value: dataDict[submission.data[fieldName]].value + 1,
          };
        }
      }
    }
    // transform dataDict to desired form
    const data = [];
    for (const entry of Object.entries(dataDict)) {
      data.push(entry[1]);
    }
    return data;
  }, [submissions, schema]);

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
