import React from "react";
import { Card } from "@formbricks/ui/Card";
import type { CardProps } from "@formbricks/ui/Card";

import { TrashIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

interface AlertCardProps extends CardProps {
  onDelete?: () => void;
  onEdit?: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ title, description, icon, onDelete, onEdit }) => (
  <div className="relative">
    <div className="absolute right-6 top-6">
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}>
          <TrashIcon className="mr-2 h-7 w-7 p-1 text-slate-500 hover:text-red-600" />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}>
          <PencilSquareIcon className="h-7 w-7 p-1 text-slate-500 hover:text-slate-800" />
        </button>
      )}
    </div>
    <Card onClick={onEdit} title={title} description={description} icon={icon} className="w-full" />
  </div>
);

export default AlertCard;
