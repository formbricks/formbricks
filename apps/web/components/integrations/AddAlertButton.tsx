"use client";

import { PlusCircleIcon } from "@heroicons/react/24/solid";

interface AddAlertButtonProps {
  channel: string;
  onClick?: () => void;
}

export const AddAlertButton: React.FC<AddAlertButtonProps> = ({ channel, onClick = () => {} }) => {
  return (
    <button
      onClick={onClick}
      className="hover:border-brand-dark cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 transition-all duration-150 ease-in-out">
      <div className="flex w-full justify-center">
        <div className="mb-4 h-10 w-10 text-center">
          <PlusCircleIcon className="text-brand-dark" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-slate-600">Add {channel} Alert</h3>
      <p className="text-xs text-slate-400">Keep your team in the loop.</p>
    </button>
  );
};
