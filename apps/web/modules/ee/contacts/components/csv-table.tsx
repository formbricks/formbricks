import { TContactCSVUploadResponse } from "@/modules/ee/contacts/types/contact";

interface CsvTableProps {
  data: TContactCSVUploadResponse;
}

export const CsvTable = ({ data }: CsvTableProps) => {
  if (data.length === 0) {
    return <p>No data available</p>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="w-full overflow-x-auto rounded-md">
      <div
        className="sticky top-0 z-10 grid gap-2 border-b-2 border-slate-100 bg-slate-100 px-3 py-2 text-left"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
        {columns.map((header, index) => (
          <span
            key={index}
            className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold capitalize leading-tight">
            {header.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {data.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-2 border-b border-gray-200 bg-white px-3 py-2 text-left leading-tight last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
          {columns.map((header, colIndex) => (
            <span key={colIndex} className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">
              {row[header]}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
