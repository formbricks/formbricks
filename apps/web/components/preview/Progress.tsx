import React from "react";

const ProgressComponent = ({ progress, brandColor }) => {
  return (
    <div className="h-1 w-full rounded-full bg-slate-200">
      <div
        className="transition-width h-1 rounded-full duration-500"
        style={{ backgroundColor: brandColor, width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
};

ProgressComponent.displayName = "Progress";

const Progress = React.memo(ProgressComponent, (prevProps, nextProps) => {
  // Only re-render if progress or brandColor changes
  return prevProps.progress === nextProps.progress && prevProps.brandColor === nextProps.brandColor;
});

export default Progress;
