import { TContactCSVUploadResponse } from "@/modules/ee/contacts/types/contact";
import React from "react";

interface CsvTableProps {
  data: TContactCSVUploadResponse;
}

export const CsvTable = ({ data }: CsvTableProps) => {
  if (data.length === 0) {
    return <p>No data available</p>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="w-full rounded-md hover:overflow-auto">
      <div
        className="grid gap-4 border-b-2 border-slate-100 bg-slate-100 p-4 text-left"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((header, index) => (
          <div key={index} className="font-semibold capitalize">
            {header.replace(/_/g, " ")}
          </div>
        ))}
      </div>

      {data.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 border-b border-gray-200 bg-white p-4 text-left last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((header, colIndex) => (
            <div key={colIndex} className="overflow-hidden text-ellipsis whitespace-nowrap">
              {row[header]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
