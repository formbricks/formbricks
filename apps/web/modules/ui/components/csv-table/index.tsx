type CsvRow = Record<string, string | number | null | undefined>;

interface CsvTableProps {
  data: CsvRow[];
}

const buildRowKey = (row: CsvRow, columns: string[], fallback: number): string => {
  const composite = columns
    .map((column) => {
      const value = row[column];
      return value === undefined || value === null ? "" : String(value);
    })
    .join("|");

  return composite.replace(/\|+$/g, "") === "" ? `row-${fallback.toString()}` : composite;
};

export const CsvTable = ({ data }: Readonly<CsvTableProps>) => {
  if (data.length === 0) {
    return <p>No data available</p>;
  }

  const columns = Object.keys(data[0]);
  const rowKeyCounts = new Map<string, number>();

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
          {data.map((row, rowIndex) => {
            const baseKey = buildRowKey(row, columns, rowIndex);
            const seen = rowKeyCounts.get(baseKey) ?? 0;
            rowKeyCounts.set(baseKey, seen + 1);
            const rowKey = seen === 0 ? baseKey : `${baseKey}#${seen.toString()}`;

            return (
              <tr key={rowKey} className="bg-white">
                {columns.map((header) => (
                  <td
                    key={`${rowKey}-${header}`}
                    className="min-w-[120px] border-b border-slate-200 px-3 py-2">
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                      {row[header] ?? ""}
                    </span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
