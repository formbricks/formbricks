export const Progress: React.FC<{ progress: number; brandColor: string }> = ({ progress, brandColor }) => {
  return (
    <div className="h-1 w-full rounded-full bg-slate-200">
      <div
        className="h-1 rounded-full bg-slate-700"
        style={{ backgroundColor: brandColor, width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
};

export default Progress;
