import { useMemo } from "react";
import { Pie, PieChart } from "recharts";

interface Props {
  color?: string;
  submissions: any;
  schema: any;
  fieldName: string;
}

function FbPie({ color, submissions, schema, fieldName }: Props) {
  const data = useMemo(() => {
    if (!fieldName) {
      throw Error("no field name provided");
    }
    if (!submissions || !schema || Object.keys(schema).length === 0) {
      return [];
    }
    // build data object by finding schema definition of field and scanning submissions for this key
    const dataDict: any = {};
    let schemaElem;
    for (const pages of schema.pages) {
      for (const elem of pages.elements) {
        if (elem.name === fieldName) {
          schemaElem = elem;
          break;
        }
      }
    }
    if (typeof schemaElem === "undefined") {
      throw Error("key not found in schema");
    }
    if (!("options" in schemaElem)) {
      throw Error(`No options found for element "${schemaElem.name}"`);
    }
    for (const option of schemaElem.options) {
      dataDict[option.value] = { name: option.label, value: 0 };
    }
    for (const submission of submissions) {
      if (fieldName in submission.data) {
        // if submission value is array (checkboxes)
        if (Array.isArray(submission.data[fieldName])) {
          for (const value of submission.data[fieldName]) {
            if (value in dataDict) {
              dataDict[value] = {
                ...dataDict[value],
                value: dataDict[value].value + 1,
              };
            }
          }
        }
        // if submission value is string (radio buttons)
        else if (typeof submission.data[fieldName] == "string") {
          if (submission.data[fieldName] in dataDict) {
            dataDict[submission.data[fieldName]] = {
              ...dataDict[submission.data[fieldName]],
              value: dataDict[submission.data[fieldName]].value + 1,
            };
          }
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
      <PieChart width={500} height={250}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={50}
          fill={color || "#00C4B8"}
          label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
            const RADIAN = Math.PI / 180;
            const radius = 25 + innerRadius + (outerRadius - innerRadius);
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);

            return value === 0 ? null : (
              <text
                x={x}
                y={y}
                fill={color || "#00C4B8"}
                fontSize={12}
                textAnchor={x > cx ? "start" : "end"}
                dominantBaseline="central">
                <tspan>
                  {/* 
// @ts-ignore */}
                  {data[index].name}
                </tspan>
                <tspan dy="20" dx="-38">
                  ({Math.round((value / submissions.length) * 100)}%)
                </tspan>
              </text>
            );
          }}
        />
      </PieChart>
    </>
  );
}

export { FbPie as Pie };
