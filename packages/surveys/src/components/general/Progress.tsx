export default function Progress({ progress }: { progress: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-[--fb-bg-2]">
      <div
        className="transition-width z-20 h-2 rounded-full bg-[--fb-primary] duration-500"
        style={{ width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
