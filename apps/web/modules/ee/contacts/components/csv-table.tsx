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
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr className="bg-slate-100">
            {columns.map((header) => (
              <th
                key={header}
                scope="col"
                className="sticky top-0 z-10 min-w-[120px] border-b-2 border-slate-200 bg-slate-100 px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="bg-white">
              {columns.map((header) => (
                <td
                  key={`${rowIndex}-${header}`}
                  className="min-w-[120px] border-b border-slate-200 px-3 py-2">
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                    {row[header] ?? ""}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
