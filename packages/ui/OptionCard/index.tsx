import Image from "next/image";

import LoadingSpinner from "../LoadingSpinner";

interface PathwayOptionProps {
  title: string;
  description: string;
  imgSrc?: string;
  loading?: boolean;
  onSelect: () => void;
}

export const OptionCard: React.FC<PathwayOptionProps> = ({
  title,
  description,
  imgSrc,
  onSelect,
  loading,
}) => (
  <div className="relative">
    <div
      className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-300 bg-white p-4 shadow-lg transition ease-in-out hover:scale-105"
      onClick={onSelect}
      role="button"
      tabIndex={0} // Make it focusable
    >
      {imgSrc && <Image src={imgSrc} alt={title} className="rounded-md" />}

      <div className="my-4 space-y-2">
        <p className="text-xl font-medium text-slate-800">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
    {loading && (
      <div className="absolute inset-0 h-full w-full bg-slate-100 opacity-50">
        <LoadingSpinner />
      </div>
    )}
  </div>
);
