export default function Progress({
  progress,
}: {
  progress: number;
  // DEPRECATED
  brandColor?: string;
}) {
  return (
    <div className="h-2 w-full rounded-full bg-[var(--fb-progress-wrapper-bg)]">
      <div
        className="transition-width z-20 h-2 rounded-full bg-[var(--fb-progress-bg)] duration-500"
        style={{ width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
