import React from "react";

interface ProgressProps {
  progress: number;
  brandColor: string;
}

const ProgressComponent = ({ progress, brandColor }: ProgressProps) => {
  return (
    <div className="h-1 w-full rounded-full bg-slate-200">
      <div
        className="transition-width h-1 rounded-full duration-500"
        style={{ backgroundColor: brandColor, width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
};

ProgressComponent.displayName = "Progress";

export const Progress = React.memo(ProgressComponent, (prevProps, nextProps) => {
  // Only re-render if progress or brandColor changes
  return prevProps.progress === nextProps.progress && prevProps.brandColor === nextProps.brandColor;
});
