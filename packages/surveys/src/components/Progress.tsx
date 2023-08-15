export default function Progress({ progress, brandColor }: { progress: number; brandColor: string }) {
  return (
    <div className="h-1 w-full rounded-full bg-slate-200">
      <div
        className="transition-width h-1 rounded-full duration-500"
        style={{ backgroundColor: brandColor, width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
