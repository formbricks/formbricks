import React from "react";
import Card, { CardProps } from "@/components/ui/Card";

import { TrashIcon, PencilIcon } from "@heroicons/react/24/outline";

interface AlertCardProps extends CardProps {
  onDelete?: () => void;
  onEdit?: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({
  href,
  title,
  description,
  icon,
  className = "",
  onDelete,
  onEdit,
}) => (
  <Card href={href} title={title} description={description} icon={icon} className={className}>
    <div className="flex justify-end">
      {onDelete && (
        <button type="button" onClick={onDelete}>
          <TrashIcon className="mr-2 h-7 w-7 p-1 text-slate-500 hover:text-slate-800" />
        </button>
      )}
      {onEdit && (
        <button type="button" onClick={onEdit}>
          <PencilIcon className="h-7 w-7 p-1 text-slate-500 hover:text-slate-800" />
        </button>
      )}
    </div>
  </Card>
);

export default AlertCard;
