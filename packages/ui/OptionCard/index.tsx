import Image from "next/image";

interface PathwayOptionProps {
  title: string;
  description: string;
  imgSrc?: string;
  onSelect: () => void;
}

export const OptionCard: React.FC<PathwayOptionProps> = ({ title, description, imgSrc, onSelect }) => (
  <div
    className="flex h-96 w-80 cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-300 bg-white p-3 shadow-lg transition ease-in-out hover:scale-105"
    onClick={onSelect}
    role="button" // Improve accessibility
    tabIndex={0} // Make it focusable
  >
    {imgSrc && <Image src={imgSrc} alt={title} className="rounded-md" />}

    <div className="my-4 space-y-2">
      <p className="text-xl font-medium text-slate-800">{title}</p>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  </div>
);
