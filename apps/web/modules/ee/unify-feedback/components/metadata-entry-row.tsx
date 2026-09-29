interface MetadataEntryRowProps {
  label: string;
  value: string;
}

export const MetadataEntryRow = ({ label, value }: Readonly<MetadataEntryRowProps>) => (
  <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2 text-xs">
    <span className="font-medium text-slate-700">{label}</span>
    <span className="truncate text-slate-600" title={value}>
      {value}
    </span>
  </div>
);
