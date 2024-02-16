import { UserGroupIcon } from "@heroicons/react/24/solid";
import { FC } from "react";

interface SegmentTitleProps {
  title?: string;
  description?: string | null | undefined;
}

const SurveySegment: FC<SegmentTitleProps> = ({ title, description }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full border border-slate-200 bg-white p-2">
        <UserGroupIcon className="h-6 w-6 text-slate-600" />
      </div>
      <div className="flex flex-col">
        <h3 className="font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
};

export default SurveySegment;
