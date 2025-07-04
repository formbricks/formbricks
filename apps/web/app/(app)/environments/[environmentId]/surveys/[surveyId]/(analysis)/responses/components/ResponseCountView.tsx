import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import React from "react";

interface ResponseCountViewProps {
  totalCount: number;
  filteredCount: number;
  paginatedCount: number;
}

export const ResponseCountView: React.FC<ResponseCountViewProps> = ({
  totalCount,
  filteredCount,
  paginatedCount,
}) => {
  const { resetState } = useResponseFilter();

  return (
    <div className="text-success-muted ml-2 text-sm">
      {totalCount > 0 && (
        <p>
          <span>{`Showing ${paginatedCount}`} of</span>
          <span>{` ${filteredCount} filtered results `}</span>
          <span
            onClick={resetState}
            className="cursor-pointer hover:underline hover:underline-offset-4">{`(${totalCount} total)`}</span>
        </p>
      )}
    </div>
  );
};
