// DataTable.tsx

interface Column {
  field: string;
  headerName: string;
}

interface DataTableProps {
  columns: Column[];
  data: { [key: string]: any }[];
}
export const DataTable = ({ columns, data }: DataTableProps) => {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={index}>{column.headerName}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column, columnIndex) => (
              <td key={columnIndex}>{row[column.field]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DataTable;
