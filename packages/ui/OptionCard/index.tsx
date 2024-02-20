import LoadingSpinner from "../LoadingSpinner";

interface PathwayOptionProps {
  title: string;
  description: string;
  loading?: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}

export const OptionCard: React.FC<PathwayOptionProps> = ({
  title,
  description,
  children,
  onSelect,
  loading,
}) => (
  <div className="relative">
    <div
      className="shadow-card flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 ease-in-out hover:scale-105 hover:border-slate-300"
      onClick={onSelect}
      role="button"
      tabIndex={0}>
      <div className="space-y-4">
        {children}
        <div className="space-y-2">
          <p className="text-xl font-medium text-slate-800">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </div>
    {loading && (
      <div className="absolute inset-0 h-full w-full bg-slate-100 opacity-50">
        <LoadingSpinner />
      </div>
    )}
  </div>
);
